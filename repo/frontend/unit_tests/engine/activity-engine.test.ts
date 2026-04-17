// REQ: R10 — Activity feed generation with filter tabs (create/edit/delete, comment, pin, rollback)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildActivityEvent,
  emitActivity,
  listActivity,
  listActivityFiltered,
} from '@/engine/activity-engine'
import { ActivityEventType, ActivityFilter, type ActivityEvent } from '@/models/activity'

const store = new Map<string, ActivityEvent>()

vi.mock('@/services/activity-repository', async () => {
  const actual = await vi.importActual<typeof import('@/services/activity-repository')>(
    '@/services/activity-repository'
  )
  return {
    ...actual,
    activityRepository: {
      put: vi.fn(async (e: ActivityEvent) => {
        store.set(e.eventId, e)
      }),
      getAll: vi.fn(async () => Array.from(store.values())),
      listByRoom: vi.fn(async (roomId: string) =>
        Array.from(store.values())
          .filter((e) => e.roomId === roomId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      ),
      listFiltered: vi.fn(async (roomId: string, filter: { filter?: ActivityFilter; actorId?: string; fromISO?: string; toISO?: string }) => {
        const all = Array.from(store.values())
          .filter((e) => e.roomId === roomId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        return all.filter((e) => {
          if (filter.filter && filter.filter !== ActivityFilter.All) {
            const allowed = actual.ACTIVITY_FILTER_TYPES?.[filter.filter] ?? []
            if (!allowed.includes(e.type)) return false
          }
          if (filter.actorId && e.actorId !== filter.actorId) return false
          if (filter.fromISO && e.createdAt < filter.fromISO) return false
          if (filter.toISO && e.createdAt > filter.toISO) return false
          return true
        })
      }),
    },
  }
})

beforeEach(() => {
  store.clear()
})

describe('buildActivityEvent', () => {
  it('builds an event with generated id and createdAt', () => {
    const event = buildActivityEvent(
      'room-1',
      ActivityEventType.ElementCreated,
      { memberId: 'm-1', displayName: 'Alice' },
      'Added a sticky note',
      { targetId: 'el-1', targetType: 'element' }
    )
    expect(event.eventId).toBeTruthy()
    expect(event.roomId).toBe('room-1')
    expect(event.type).toBe(ActivityEventType.ElementCreated)
    expect(event.actorId).toBe('m-1')
    expect(event.createdAt).toBeTruthy()
    expect(event.targetId).toBe('el-1')
    expect(event.targetType).toBe('element')
  })

  it('allows event construction without a target', () => {
    const event = buildActivityEvent(
      'room-1',
      ActivityEventType.RoomCreated,
      { memberId: 'host', displayName: 'Host' },
      'Created a room'
    )
    expect(event.targetId).toBeUndefined()
    expect(event.targetType).toBeUndefined()
  })
})

describe('emitActivity + listActivity', () => {
  it('persists events and returns them in order', async () => {
    await emitActivity('room-1', ActivityEventType.ElementCreated, { memberId: 'a', displayName: 'A' }, 'one')
    await new Promise((r) => setTimeout(r, 2))
    await emitActivity('room-1', ActivityEventType.ElementUpdated, { memberId: 'a', displayName: 'A' }, 'two')

    const events = await listActivity('room-1')
    expect(events).toHaveLength(2)
    expect(events[0].summary).toBe('one')
    expect(events[1].summary).toBe('two')
  })

  it('scopes events by room', async () => {
    await emitActivity('room-1', ActivityEventType.ElementCreated, { memberId: 'a', displayName: 'A' }, 'r1')
    await emitActivity('room-2', ActivityEventType.ElementCreated, { memberId: 'a', displayName: 'A' }, 'r2')
    const r1 = await listActivity('room-1')
    const r2 = await listActivity('room-2')
    expect(r1).toHaveLength(1)
    expect(r2).toHaveLength(1)
  })
})

describe('listActivityFiltered', () => {
  beforeEach(async () => {
    await emitActivity('room-1', ActivityEventType.ElementCreated, { memberId: 'a', displayName: 'A' }, 'c')
    await emitActivity('room-1', ActivityEventType.CommentAdded, { memberId: 'b', displayName: 'B' }, 'x')
    await emitActivity('room-1', ActivityEventType.MessagePinned, { memberId: 'a', displayName: 'A' }, 'p')
    await emitActivity('room-1', ActivityEventType.SnapshotRolledBack, { memberId: 'b', displayName: 'B' }, 'r')
    await emitActivity('room-1', ActivityEventType.MemberJoined, { memberId: 'c', displayName: 'C' }, 'j')
  })

  it('filters by Elements tab', async () => {
    const result = await listActivityFiltered('room-1', { filter: ActivityFilter.Elements })
    expect(result.every((e) => e.type === ActivityEventType.ElementCreated)).toBe(true)
  })

  it('filters by Comments tab', async () => {
    const result = await listActivityFiltered('room-1', { filter: ActivityFilter.Comments })
    expect(result.every((e) => e.type === ActivityEventType.CommentAdded)).toBe(true)
  })

  it('filters by Pins tab', async () => {
    const result = await listActivityFiltered('room-1', { filter: ActivityFilter.Pins })
    expect(result.every((e) => e.type === ActivityEventType.MessagePinned)).toBe(true)
  })

  it('filters by Rollbacks tab', async () => {
    const result = await listActivityFiltered('room-1', { filter: ActivityFilter.Rollbacks })
    expect(result.every((e) => e.type === ActivityEventType.SnapshotRolledBack)).toBe(true)
  })

  it('filters by Membership tab', async () => {
    const result = await listActivityFiltered('room-1', { filter: ActivityFilter.Membership })
    expect(result.every((e) => e.type === ActivityEventType.MemberJoined)).toBe(true)
  })

  it('filters by actorId', async () => {
    const result = await listActivityFiltered('room-1', { actorId: 'a' })
    expect(result).toHaveLength(2)
    expect(result.every((e) => e.actorId === 'a')).toBe(true)
  })

  it('filters by date range', async () => {
    const all = await listActivity('room-1')
    const mid = all[2].createdAt
    const result = await listActivityFiltered('room-1', { fromISO: mid })
    expect(result.every((e) => e.createdAt >= mid)).toBe(true)
  })
})

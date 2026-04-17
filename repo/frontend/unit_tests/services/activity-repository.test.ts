// REQ: R10 — Activity feed persistence + filter queries

import { describe, it, expect, beforeEach } from 'vitest'
import { activityRepository } from '@/services/activity-repository'
import { closeDatabaseConnection } from '@/services/db-schema'
import { DB_NAME } from '@/models/constants'
import { ActivityEventType, ActivityFilter } from '@/models/activity'
import type { ActivityEvent } from '@/models/activity'

async function resetDb() {
  await closeDatabaseConnection()
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

function makeEvent(
  eventId: string,
  roomId: string,
  type: ActivityEventType,
  createdAt: string,
  actorId = 'actor-1',
): ActivityEvent {
  return {
    eventId,
    roomId,
    type,
    actorId,
    actorDisplayName: actorId,
    summary: `${type}`,
    createdAt,
  }
}

describe('activityRepository', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('listByRoom returns events sorted ascending by createdAt', async () => {
    await activityRepository.put(
      makeEvent('e3', 'r1', ActivityEventType.ElementCreated, '2026-01-03T00:00:00.000Z'),
    )
    await activityRepository.put(
      makeEvent('e1', 'r1', ActivityEventType.ElementCreated, '2026-01-01T00:00:00.000Z'),
    )
    await activityRepository.put(
      makeEvent('e2', 'r1', ActivityEventType.ElementCreated, '2026-01-02T00:00:00.000Z'),
    )
    const list = await activityRepository.listByRoom('r1')
    expect(list.map((e) => e.eventId)).toEqual(['e1', 'e2', 'e3'])
  })

  it('listByRoom returns only events for the requested room', async () => {
    await activityRepository.put(
      makeEvent('a', 'r1', ActivityEventType.ElementCreated, '2026-01-01T00:00:00.000Z'),
    )
    await activityRepository.put(
      makeEvent('b', 'r2', ActivityEventType.ElementCreated, '2026-01-01T00:00:00.000Z'),
    )
    const list = await activityRepository.listByRoom('r1')
    expect(list.length).toBe(1)
    expect(list[0].eventId).toBe('a')
  })

  it('listFiltered narrows by ActivityFilter.Comments', async () => {
    await activityRepository.put(
      makeEvent('el', 'r1', ActivityEventType.ElementCreated, '2026-01-01T00:00:00.000Z'),
    )
    await activityRepository.put(
      makeEvent('cm', 'r1', ActivityEventType.CommentAdded, '2026-01-01T00:00:01.000Z'),
    )
    const list = await activityRepository.listFiltered('r1', {
      filter: ActivityFilter.Comments,
    })
    expect(list.map((e) => e.eventId)).toEqual(['cm'])
  })

  it('listFiltered narrows by actorId', async () => {
    await activityRepository.put(
      makeEvent('x', 'r1', ActivityEventType.ElementCreated, '2026-01-01T00:00:00.000Z', 'a'),
    )
    await activityRepository.put(
      makeEvent('y', 'r1', ActivityEventType.ElementCreated, '2026-01-01T00:00:01.000Z', 'b'),
    )
    const list = await activityRepository.listFiltered('r1', { actorId: 'a' })
    expect(list.map((e) => e.eventId)).toEqual(['x'])
  })

  it('listFiltered applies fromISO / toISO bounds inclusively', async () => {
    await activityRepository.put(
      makeEvent('e1', 'r1', ActivityEventType.ElementCreated, '2026-01-01T00:00:00.000Z'),
    )
    await activityRepository.put(
      makeEvent('e2', 'r1', ActivityEventType.ElementCreated, '2026-01-05T00:00:00.000Z'),
    )
    await activityRepository.put(
      makeEvent('e3', 'r1', ActivityEventType.ElementCreated, '2026-01-10T00:00:00.000Z'),
    )
    const list = await activityRepository.listFiltered('r1', {
      fromISO: '2026-01-02T00:00:00.000Z',
      toISO: '2026-01-06T00:00:00.000Z',
    })
    expect(list.map((e) => e.eventId)).toEqual(['e2'])
  })

  it('returns an empty array when no events match', async () => {
    expect(await activityRepository.listByRoom('empty')).toEqual([])
  })
})

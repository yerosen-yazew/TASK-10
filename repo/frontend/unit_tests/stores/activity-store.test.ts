// REQ: R10 — Activity store refresh, filter, and error path

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ActivityEventType, ActivityFilter } from '@/models/activity'
import type { ActivityEvent } from '@/models/activity'

const listActivityFiltered = vi.fn<any, Promise<ActivityEvent[]>>()
vi.mock('@/engine/activity-engine', () => ({
  listActivityFiltered: (...args: any[]) => listActivityFiltered(...args),
}))

const loggerError = vi.fn()
vi.mock('@/utils/logger', () => ({
  logger: { error: loggerError, info: vi.fn(), warn: vi.fn() },
}))

import { useActivityStore } from '@/stores/activity-store'

function makeEvent(id: string, actorId = 'a1'): ActivityEvent {
  return {
    eventId: id,
    roomId: 'r1',
    type: ActivityEventType.ElementCreated,
    actorId,
    actorDisplayName: actorId,
    summary: 'ok',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('activity-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('refresh loads events using the current filter', async () => {
    listActivityFiltered.mockResolvedValueOnce([makeEvent('e1'), makeEvent('e2')])
    const store = useActivityStore()
    await store.refresh('r1')
    expect(listActivityFiltered).toHaveBeenCalledWith('r1', {
      filter: ActivityFilter.All,
      actorId: undefined,
    })
    expect(store.events.length).toBe(2)
    expect(store.isLoading).toBe(false)
    expect(store.lastError).toBeNull()
  })

  it('setFilter updates the active filter used by subsequent refreshes', async () => {
    const store = useActivityStore()
    store.setFilter(ActivityFilter.Comments)
    listActivityFiltered.mockResolvedValueOnce([])
    await store.refresh('r1')
    expect(listActivityFiltered).toHaveBeenLastCalledWith('r1', {
      filter: ActivityFilter.Comments,
      actorId: undefined,
    })
  })

  it('setActorFilter scopes filteredEvents client-side', () => {
    const store = useActivityStore()
    store.events = [makeEvent('a', 'alice'), makeEvent('b', 'bob')] as any
    store.setActorFilter('alice')
    expect(store.filteredEvents.map((e) => e.eventId)).toEqual(['a'])
  })

  it('filteredEvents returns all events when no actor filter is set', () => {
    const store = useActivityStore()
    store.events = [makeEvent('a'), makeEvent('b')] as any
    expect(store.filteredEvents.length).toBe(2)
  })

  it('refresh sets lastError on engine failure', async () => {
    listActivityFiltered.mockRejectedValueOnce(new Error('boom'))
    const store = useActivityStore()
    await store.refresh('r1')
    expect(store.lastError).toBe('Failed to load activity feed.')
    expect(loggerError).toHaveBeenCalled()
    expect(store.isLoading).toBe(false)
  })
})

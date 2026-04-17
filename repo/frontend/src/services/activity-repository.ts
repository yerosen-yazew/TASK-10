// REQ: R10 — Activity feed persistence and filter support

import { BaseRepository } from './base-repository'
import type { ActivityEvent } from '@/models/activity'
import { ACTIVITY_FILTER_TYPES, ActivityFilter } from '@/models/activity'

export interface ActivityFeedFilter {
  /** Restrict to a filter tab (maps to a set of event types). */
  filter?: ActivityFilter
  /** Restrict to a specific actor (memberId). */
  actorId?: string
  /** Inclusive ISO lower bound for createdAt. */
  fromISO?: string
  /** Inclusive ISO upper bound for createdAt. */
  toISO?: string
}

/** Repository for activity feed events. */
class ActivityRepository extends BaseRepository<ActivityEvent, string> {
  protected readonly storeName = 'activityFeed'

  /** List activity events for a room (ascending by createdAt). */
  async listByRoom(roomId: string): Promise<ActivityEvent[]> {
    const rows = await this.query('by-roomId', roomId)
    return rows.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  /** List activity events for a room constrained by filter criteria. */
  async listFiltered(roomId: string, filter: ActivityFeedFilter): Promise<ActivityEvent[]> {
    const base = await this.listByRoom(roomId)
    const allowedTypes = filter.filter
      ? new Set(ACTIVITY_FILTER_TYPES[filter.filter])
      : null
    return base.filter((event) => {
      if (allowedTypes && !allowedTypes.has(event.type)) return false
      if (filter.actorId && event.actorId !== filter.actorId) return false
      if (filter.fromISO && event.createdAt < filter.fromISO) return false
      if (filter.toISO && event.createdAt > filter.toISO) return false
      return true
    })
  }
}

/** Singleton activity repository. */
export const activityRepository = new ActivityRepository()

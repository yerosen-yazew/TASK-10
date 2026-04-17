// REQ: R10 — Activity feed generation for create/edit/delete, comment, pin, rollback, membership

import {
  ActivityEventType,
  type ActivityEvent,
  type ActivityFilter,
} from '@/models/activity'
import { activityRepository, type ActivityFeedFilter } from '@/services/activity-repository'
import { generateId } from '@/utils/id-generator'
import { nowISO } from '@/utils/date-utils'

/** Input describing the actor behind an activity event. */
export interface ActivityActor {
  memberId: string
  displayName: string
}

/** Optional target reference for an activity event. */
export interface ActivityTarget {
  targetId?: string
  targetType?: 'element' | 'comment' | 'message' | 'snapshot' | 'member'
}

/** Build an activity event without persisting it (useful for tests and snapshots). */
export function buildActivityEvent(
  roomId: string,
  type: ActivityEventType,
  actor: ActivityActor,
  summary: string,
  target?: ActivityTarget,
  metadata?: Record<string, unknown>
): ActivityEvent {
  return {
    eventId: generateId(),
    roomId,
    type,
    actorId: actor.memberId,
    actorDisplayName: actor.displayName,
    summary,
    targetId: target?.targetId,
    targetType: target?.targetType,
    metadata,
    createdAt: nowISO(),
  }
}

/** Persist an activity event to the activity feed. */
export async function recordActivity(event: ActivityEvent): Promise<void> {
  await activityRepository.put(event)
}

/** Build-and-record convenience for engines that emit a single event. */
export async function emitActivity(
  roomId: string,
  type: ActivityEventType,
  actor: ActivityActor,
  summary: string,
  target?: ActivityTarget,
  metadata?: Record<string, unknown>
): Promise<ActivityEvent> {
  const event = buildActivityEvent(roomId, type, actor, summary, target, metadata)
  await recordActivity(event)
  return event
}

/** List all activity events for a room (ascending by createdAt). */
export async function listActivity(
  roomId: string,
  filter?: ActivityFilter
): Promise<ActivityEvent[]> {
  if (!filter) {
    return activityRepository.listByRoom(roomId)
  }
  return activityRepository.listFiltered(roomId, { filter })
}

/** Advanced listing with full filter spec (actor, date range, type tab). */
export async function listActivityFiltered(
  roomId: string,
  filter: ActivityFeedFilter
): Promise<ActivityEvent[]> {
  return activityRepository.listFiltered(roomId, filter)
}

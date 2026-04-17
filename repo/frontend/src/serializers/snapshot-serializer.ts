// REQ: R17 — Snapshots every 5 min, keep 48, one-click rollback

import type { Snapshot, SnapshotData } from '@/models/snapshot'
import { generateId } from '@/utils/id-generator'
import { nowISO } from '@/utils/date-utils'
import { estimateJsonSize } from '@/utils/size-utils'
import type { WhiteboardElement } from '@/models/element'
import type { ChatMessage, PinnedMessage } from '@/models/chat'
import type { CommentThread, Comment } from '@/models/comment'
import type { MemberRecord } from '@/models/room'
import type { ActivityEvent } from '@/models/activity'

/** Input for creating a snapshot of the current room state. */
export interface SnapshotInput {
  roomId: string
  sequenceNumber: number
  elements: WhiteboardElement[]
  chatMessages: ChatMessage[]
  pinnedMessages: PinnedMessage[]
  commentThreads: CommentThread[]
  comments: Comment[]
  members: MemberRecord[]
  activityEvents: ActivityEvent[]
}

/**
 * Create a full room state snapshot from the current data.
 */
export function createSnapshot(input: SnapshotInput): Snapshot {
  const data: SnapshotData = {
    elements: input.elements,
    chatMessages: input.chatMessages,
    pinnedMessages: input.pinnedMessages,
    commentThreads: input.commentThreads,
    comments: input.comments,
    members: input.members,
    activityEvents: input.activityEvents,
  }

  return {
    snapshotId: generateId(),
    roomId: input.roomId,
    sequenceNumber: input.sequenceNumber,
    data,
    createdAt: nowISO(),
    sizeBytes: estimateJsonSize(data),
  }
}

/**
 * Serialize a snapshot to a JSON string for storage.
 */
export function serializeSnapshot(snapshot: Snapshot): string {
  return JSON.stringify(snapshot)
}

/**
 * Deserialize a JSON string back to a Snapshot.
 * Returns null if parsing fails.
 */
export function deserializeSnapshot(json: string): Snapshot | null {
  try {
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return null
    if (!parsed.snapshotId || !parsed.roomId || !parsed.data) return null
    return parsed as Snapshot
  } catch {
    return null
  }
}

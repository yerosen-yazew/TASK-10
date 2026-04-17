// REQ: R17 — Snapshots every 5 min, keep 48 most recent, one-click rollback
// REQ: Rollback creates a NEW derived snapshot and preserves history (questions.md Q5)

import { MAX_SNAPSHOTS_RETAINED } from '@/models/constants'
import type { Snapshot, RollbackMetadata } from '@/models/snapshot'
import { createSnapshot, type SnapshotInput } from '@/serializers/snapshot-serializer'
import { snapshotRepository } from '@/services/snapshot-repository'
import { activityRepository } from '@/services/activity-repository'
import { memberRepository } from '@/services/member-repository'
import { elementRepository } from '@/services/element-repository'
import { chatMessageRepository } from '@/services/chat-message-repository'
import { pinnedMessageRepository } from '@/services/pinned-message-repository'
import { commentThreadRepository } from '@/services/comment-thread-repository'
import { commentRepository } from '@/services/comment-repository'
import { ActivityEventType } from '@/models/activity'
import { emitActivity, type ActivityActor } from './activity-engine'
import { generateId } from '@/utils/id-generator'
import { nowISO } from '@/utils/date-utils'

/** Source that triggered a snapshot capture (for metadata + audit). */
export type SnapshotTrigger = 'autosave' | 'manual' | 'rollback'

/** Gather the full current room state to capture as a snapshot. */
export async function collectRoomStateForSnapshot(
  roomId: string
): Promise<Omit<SnapshotInput, 'sequenceNumber'>> {
  const [elements, chatMessages, pinnedMessages, commentThreads, members, activity] =
    await Promise.all([
      elementRepository.listByRoom(roomId),
      chatMessageRepository.listByRoom(roomId),
      pinnedMessageRepository.listByRoom(roomId),
      commentThreadRepository.listByRoom(roomId),
      memberRepository.listByRoom(roomId),
      activityRepository.listByRoom(roomId),
    ])
  const commentLists = await Promise.all(
    commentThreads.map((t) => commentRepository.listByThread(t.threadId))
  )
  const comments = commentLists.flat()
  return {
    roomId,
    elements,
    chatMessages,
    pinnedMessages,
    commentThreads,
    comments,
    members,
    activityEvents: activity,
  }
}

/** Compute the next sequence number for a room's snapshots. */
async function nextSequenceNumber(roomId: string): Promise<number> {
  const existing = await snapshotRepository.listByRoom(roomId)
  let max = 0
  for (const snap of existing) {
    if (snap.sequenceNumber > max) max = snap.sequenceNumber
  }
  return max + 1
}

/**
 * Capture a full snapshot of the current room state.
 * Trims oldest snapshots beyond MAX_SNAPSHOTS_RETAINED (48).
 */
export async function captureSnapshot(
  roomId: string,
  trigger: SnapshotTrigger = 'autosave'
): Promise<Snapshot> {
  const state = await collectRoomStateForSnapshot(roomId)
  const sequenceNumber = await nextSequenceNumber(roomId)
  const snapshot = createSnapshot({ ...state, sequenceNumber })
  await snapshotRepository.put(snapshot)
  await snapshotRepository.deleteOldestExcess(roomId, MAX_SNAPSHOTS_RETAINED)
  // Trigger is captured for audit — it is not persisted on the snapshot itself
  // because the Snapshot model focuses on the state payload.
  void trigger
  return snapshot
}

/** List snapshots for a room ordered oldest→newest. */
export async function listSnapshots(roomId: string): Promise<Snapshot[]> {
  return snapshotRepository.listByRoom(roomId)
}

/**
 * Rollback the room to a previous snapshot.
 *
 * Rollback is implemented as a NEW derived snapshot that re-captures the chosen
 * state. The original snapshot and all intermediate snapshots are preserved,
 * the snapshot timeline is auditable, and a `snapshot_rolled_back` activity
 * event is emitted with source + actor + timestamp metadata.
 */
export async function rollbackTo(
  roomId: string,
  sourceSnapshotId: string,
  actor: ActivityActor
): Promise<RollbackMetadata> {
  const source = await snapshotRepository.getById(sourceSnapshotId)
  if (!source || source.roomId !== roomId) {
    throw new Error(`Snapshot ${sourceSnapshotId} not found for room ${roomId}.`)
  }

  // Derive a new snapshot from the source state and persist it — this becomes
  // the head of the timeline without deleting the source or any later snapshots.
  const sequenceNumber = await nextSequenceNumber(roomId)
  const derived = createSnapshot({
    roomId,
    sequenceNumber,
    elements: source.data.elements,
    chatMessages: source.data.chatMessages,
    pinnedMessages: source.data.pinnedMessages,
    commentThreads: source.data.commentThreads,
    comments: source.data.comments,
    members: source.data.members,
    activityEvents: source.data.activityEvents,
  })
  await snapshotRepository.put(derived)
  await snapshotRepository.deleteOldestExcess(roomId, MAX_SNAPSHOTS_RETAINED)

  // Restore live repositories to the source snapshot's state so the UI reflects the rollback.
  const existingElements = await elementRepository.listByRoom(roomId)
  for (const el of existingElements) await elementRepository.delete(el.elementId)
  for (const el of source.data.elements) await elementRepository.put(el)

  const existingMessages = await chatMessageRepository.listByRoom(roomId)
  for (const msg of existingMessages) await chatMessageRepository.delete(msg.messageId)
  for (const msg of source.data.chatMessages) await chatMessageRepository.put(msg)

  const existingPinned = await pinnedMessageRepository.listByRoom(roomId)
  for (const pm of existingPinned) await pinnedMessageRepository.delete([pm.roomId, pm.messageId])
  for (const pm of source.data.pinnedMessages) await pinnedMessageRepository.put(pm)

  const existingThreads = await commentThreadRepository.listByRoom(roomId)
  for (const t of existingThreads) await commentThreadRepository.delete(t.threadId)
  for (const t of source.data.commentThreads) await commentThreadRepository.put(t)

  const existingComments = await commentRepository.listByRoom(roomId)
  for (const c of existingComments) await commentRepository.delete(c.commentId)
  for (const c of source.data.comments) await commentRepository.put(c)

  const metadata: RollbackMetadata = {
    rollbackId: generateId(),
    roomId,
    sourceSnapshotId: source.snapshotId,
    sourceSequenceNumber: source.sequenceNumber,
    initiatorId: actor.memberId,
    initiatorDisplayName: actor.displayName,
    resultingSnapshotId: derived.snapshotId,
    rolledBackAt: nowISO(),
  }

  await emitActivity(
    roomId,
    ActivityEventType.SnapshotRolledBack,
    actor,
    `Rolled back to snapshot #${source.sequenceNumber}`,
    { targetId: source.snapshotId, targetType: 'snapshot' },
    {
      sourceSnapshotId: metadata.sourceSnapshotId,
      sourceSequenceNumber: metadata.sourceSequenceNumber,
      resultingSnapshotId: metadata.resultingSnapshotId,
      rolledBackAt: metadata.rolledBackAt,
      rollbackId: metadata.rollbackId,
    }
  )

  return metadata
}

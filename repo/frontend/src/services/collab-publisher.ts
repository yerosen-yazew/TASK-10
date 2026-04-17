// REQ: R18 — BroadcastChannel outbound publication
// REQ: R19 — WebRTC DataChannel outbound publication
// Centralized publisher that fans every write-op signal out to both
// multi-tab (BroadcastChannel) and LAN peer (WebRTC) transports.
// Stores call these helpers after successful mutations; adaptors on the
// receive side refresh local state.

import {
  broadcastElementChange,
  broadcastChatMessage,
  broadcastPinChange,
  broadcastMembershipChange,
  broadcastSnapshotCreated,
  broadcastRollbackApplied,
  broadcastConflictNotify,
} from './broadcast-adaptor'
import { broadcastCollabMessage } from './webrtc-peer-service'
import type {
  CollabMessage,
  CollabMessageType,
  ElementOpPayload,
  ChatOpPayload,
  CommentOpPayload,
  ApprovalOpPayload,
  SnapshotOpPayload,
  RollbackOpPayload,
} from '@/models/collaboration'
import type { CursorPosition } from '@/models/presence'
import type { WhiteboardElement } from '@/models/element'
import type { ChatMessage, PinnedMessage } from '@/models/chat'
import type { Comment, CommentThread } from '@/models/comment'
import type { MemberRecord } from '@/models/room'
import type { Snapshot } from '@/models/snapshot'

let seqCounter = 0
function nextSeq(): number {
  seqCounter += 1
  return seqCounter
}

function nowISO(): string {
  return new Date().toISOString()
}

function envelope<T>(
  type: CollabMessageType,
  roomId: string,
  senderId: string,
  payload: T
): CollabMessage<T> {
  return {
    type,
    senderId,
    timestamp: nowISO(),
    seqNum: nextSeq(),
    roomId,
    payload,
  }
}

/** Reset the module-local sequence counter. Test-only. */
export function __resetSeqForTests(): void {
  seqCounter = 0
}

/** Publish an element mutation to other tabs and LAN peers. */
export function publishElement(
  roomId: string,
  operation: 'create' | 'update' | 'delete',
  elementId: string,
  senderId = 'local',
  element?: WhiteboardElement
): void {
  broadcastElementChange(roomId, operation, elementId)
  const payload: ElementOpPayload = { operation, elementId, element }
  broadcastCollabMessage(
    envelope('element-op', roomId, senderId, payload)
  )
}

/** Publish a chat message creation/deletion. */
export function publishChat(
  roomId: string,
  operation: 'new' | 'delete',
  messageId: string,
  senderId = 'local',
  message?: ChatMessage
): void {
  broadcastChatMessage(roomId, operation, messageId)
  const payload: ChatOpPayload = { operation, messageId, message }
  broadcastCollabMessage(
    envelope('chat-op', roomId, senderId, payload)
  )
}

/** Publish a pin/unpin event. */
export function publishPin(
  roomId: string,
  operation: 'pin' | 'unpin',
  messageId: string,
  senderId = 'local',
  pinned?: PinnedMessage
): void {
  broadcastPinChange(roomId, operation, messageId)
  const payload: ChatOpPayload = { operation, messageId, pinned }
  broadcastCollabMessage(
    envelope('chat-op', roomId, senderId, payload)
  )
}

/** Publish comment-thread operations to LAN peers. */
export function publishComment(
  roomId: string,
  operation: 'create-thread' | 'append-comment',
  threadId: string,
  elementId: string,
  senderId = 'local',
  thread?: CommentThread,
  comment?: Comment
): void {
  const payload: CommentOpPayload = {
    operation,
    threadId,
    elementId,
    thread,
    comment,
  }
  broadcastCollabMessage(
    envelope('comment-op', roomId, senderId, payload)
  )
}

/** Publish a membership state transition (request/approve/reject/leave). */
export function publishMembership(
  roomId: string,
  operation: 'request' | 'approve' | 'reject' | 'leave',
  memberId: string,
  senderId = 'local',
  member?: MemberRecord
): void {
  broadcastMembershipChange(roomId, operation, memberId)
  const payload: ApprovalOpPayload = { operation, memberId, member }
  broadcastCollabMessage(
    envelope('approval-op', roomId, senderId, payload)
  )
}

/** Publish a snapshot creation. */
export function publishSnapshot(
  roomId: string,
  snapshotId: string,
  sequenceNumber: number,
  senderId = 'local',
  snapshot?: Snapshot
): void {
  broadcastSnapshotCreated(roomId, snapshotId, sequenceNumber)
  const payload: SnapshotOpPayload = {
    operation: 'snapshot-created',
    snapshotId,
    sequenceNumber,
    snapshot,
  }
  broadcastCollabMessage(
    envelope('snapshot-op', roomId, senderId, payload)
  )
}

/** Publish a rollback completion. */
export function publishRollback(
  roomId: string,
  snapshotId: string,
  initiatorId: string,
  resultingSnapshotId: string,
  senderId = initiatorId,
  snapshot?: Snapshot
): void {
  broadcastRollbackApplied(roomId, snapshotId, initiatorId, resultingSnapshotId)
  const payload: RollbackOpPayload = {
    operation: 'rollback-applied',
    snapshotId,
    initiatorId,
    resultingSnapshotId,
    snapshot,
  }
  broadcastCollabMessage(
    envelope('rollback-op', roomId, senderId, payload)
  )
}

/**
 * Publish a local presence/cursor update to LAN peers as a `presence-op`.
 * No BroadcastChannel counterpart — cursor presence is intentionally not
 * fanned across tabs (each tab is its own user perspective; the LAN peer
 * bridge is where remote cursors need to arrive).
 */
export function publishPresence(
  roomId: string,
  memberId: string,
  cursor: CursorPosition | null,
  displayName: string,
  avatarColor: string,
  senderId = memberId
): void {
  broadcastCollabMessage(
    envelope('presence-op', roomId, senderId, {
      memberId,
      roomId,
      displayName,
      avatarColor,
      isOnline: true,
      cursor,
      currentTool: null,
      lastSeenAt: nowISO(),
    })
  )
}

/** Publish a conflict notification. */
export function publishConflict(
  roomId: string,
  conflictType: 'element-overwrite' | 'pin-collision' | 'membership-race' | 'rollback-collision',
  resourceId: string,
  conflictingTabId: string,
  message: string,
  senderId = 'local'
): void {
  broadcastConflictNotify(roomId, conflictType, resourceId, conflictingTabId, message)
  broadcastCollabMessage(
    envelope('conflict-op', roomId, senderId, {
      conflictType,
      resourceId,
      conflictingTabId,
      message,
    })
  )
}

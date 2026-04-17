// REQ: R16 — Auto-save every 10 seconds
// REQ: R17 — Snapshots every 5 min, keep 48, one-click rollback with confirmation

import type { WhiteboardElement } from './element'
import type { ChatMessage, PinnedMessage } from './chat'
import type { Comment, CommentThread } from './comment'
import type { MemberRecord } from './room'
import type { ActivityEvent } from './activity'

/** A full room state snapshot for rollback. */
export interface Snapshot {
  snapshotId: string
  roomId: string
  /** Monotonic snapshot number within the room for ordering. */
  sequenceNumber: number
  /** Serialized room state at the time of snapshot. */
  data: SnapshotData
  createdAt: string          // ISO 8601
  /** Size in bytes of the serialized data (for display). */
  sizeBytes: number
}

/** The data contained within a snapshot — a frozen copy of room state. */
export interface SnapshotData {
  elements: WhiteboardElement[]
  chatMessages: ChatMessage[]
  pinnedMessages: PinnedMessage[]
  commentThreads: CommentThread[]
  comments: Comment[]
  members: MemberRecord[]
  activityEvents: ActivityEvent[]
}

/**
 * Metadata recorded when a rollback is performed.
 * Rollback creates a NEW room state from a chosen snapshot (non-destructive).
 */
export interface RollbackMetadata {
  rollbackId: string
  roomId: string
  /** The snapshot that was rolled back to. */
  sourceSnapshotId: string
  sourceSequenceNumber: number
  /** Who initiated the rollback. */
  initiatorId: string
  initiatorDisplayName: string
  /** The new snapshot created as a result of the rollback. */
  resultingSnapshotId: string
  rolledBackAt: string       // ISO 8601
}

/** Auto-save tracking state (in-memory, not persisted to IndexedDB). */
export interface AutoSaveState {
  roomId: string
  lastSavedAt: string | null   // ISO 8601
  isDirty: boolean
  isSaving: boolean
  lastError: string | null
}

// REQ: R18 — BroadcastChannel conflict toasts and overwrite prevention

/** Event types for BroadcastChannel multi-tab sync. */
export type BroadcastEventType =
  | 'element-change'
  | 'chat-message'
  | 'presence-update'
  | 'membership-change'
  | 'conflict-notify'
  | 'session-lock'
  | 'snapshot-created'
  | 'rollback-applied'
  | 'pin-change'

/** Base envelope for all BroadcastChannel messages. */
export interface BroadcastEnvelope<T = unknown> {
  type: BroadcastEventType
  tabId: string               // sender's unique tab session ID
  timestamp: string           // ISO 8601
  roomId?: string             // room context (if applicable)
  payload: T
}

/** Payload for element CRUD operations broadcast. */
export interface ElementChangePayload {
  operation: 'create' | 'update' | 'delete'
  elementId: string
  elementType?: 'sticky-note' | 'arrow' | 'pen-stroke' | 'image'
  data?: Record<string, unknown>
}

/** Payload for chat message broadcast. */
export interface ChatMessagePayload {
  operation: 'new' | 'delete'
  messageId: string
  content?: string
  authorId?: string
}

/** Payload for presence updates broadcast. */
export interface PresenceUpdatePayload {
  memberId: string
  cursorX?: number
  cursorY?: number
  isActive: boolean
  currentTool?: string
}

/** Payload for membership changes broadcast. */
export interface MembershipChangePayload {
  operation: 'request' | 'approve' | 'reject' | 'leave'
  memberId: string
  approvedBy?: string
  isSecondApproval?: boolean
}

/** Payload for conflict notifications broadcast. */
export interface ConflictNotifyPayload {
  conflictType: 'element-overwrite' | 'pin-collision' | 'membership-race' | 'rollback-collision'
  resourceId: string
  conflictingTabId: string
  message: string
}

/** Payload for session lock/unlock propagation. */
export interface SessionLockPayload {
  action: 'lock' | 'unlock' | 'sign-out'
  profileId: string
}

/** Payload for pin change broadcast. */
export interface PinChangePayload {
  operation: 'pin' | 'unpin'
  messageId: string
  pinnedBy?: string
}

/** Payload for snapshot creation notification. */
export interface SnapshotCreatedPayload {
  snapshotId: string
  sequenceNumber: number
}

/** Payload for rollback notification. */
export interface RollbackAppliedPayload {
  snapshotId: string
  initiatorId: string
  resultingSnapshotId: string
}

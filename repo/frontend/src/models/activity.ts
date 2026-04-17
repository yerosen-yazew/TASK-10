// REQ: R10 — Activity feed with filter tabs (create/edit/delete, comment, pin, rollback)

/** Types of activity events tracked in the feed. */
export enum ActivityEventType {
  ElementCreated = 'element_created',
  ElementUpdated = 'element_updated',
  ElementDeleted = 'element_deleted',
  CommentAdded = 'comment_added',
  CommentEdited = 'comment_edited',
  CommentDeleted = 'comment_deleted',
  MessagePinned = 'message_pinned',
  MessageUnpinned = 'message_unpinned',
  SnapshotRolledBack = 'snapshot_rolled_back',
  MemberJoined = 'member_joined',
  MemberLeft = 'member_left',
  MemberApproved = 'member_approved',
  MemberRejected = 'member_rejected',
  RoomCreated = 'room_created',
}

/** A single activity feed event. */
export interface ActivityEvent {
  eventId: string
  roomId: string
  type: ActivityEventType
  actorId: string            // memberId who performed the action
  actorDisplayName: string
  /** Human-readable summary of the event. */
  summary: string
  /** Optional reference to the affected resource. */
  targetId?: string          // elementId, commentId, messageId, snapshotId, memberId
  targetType?: 'element' | 'comment' | 'message' | 'snapshot' | 'member'
  /** Extra metadata specific to the event type. */
  metadata?: Record<string, unknown>
  createdAt: string          // ISO 8601
}

/** Filter tabs for the activity feed UI. */
export enum ActivityFilter {
  All = 'all',
  Elements = 'elements',       // create/edit/delete of whiteboard elements
  Comments = 'comments',       // comment add/edit/delete
  Pins = 'pins',               // pin/unpin
  Rollbacks = 'rollbacks',     // snapshot rollback events
  Membership = 'membership',   // join/leave/approve/reject
}

/** Map from filter tab to the event types it includes. */
export const ACTIVITY_FILTER_TYPES: Record<ActivityFilter, ActivityEventType[]> = {
  [ActivityFilter.All]: Object.values(ActivityEventType),
  [ActivityFilter.Elements]: [
    ActivityEventType.ElementCreated,
    ActivityEventType.ElementUpdated,
    ActivityEventType.ElementDeleted,
  ],
  [ActivityFilter.Comments]: [
    ActivityEventType.CommentAdded,
    ActivityEventType.CommentEdited,
    ActivityEventType.CommentDeleted,
  ],
  [ActivityFilter.Pins]: [
    ActivityEventType.MessagePinned,
    ActivityEventType.MessageUnpinned,
  ],
  [ActivityFilter.Rollbacks]: [
    ActivityEventType.SnapshotRolledBack,
  ],
  [ActivityFilter.Membership]: [
    ActivityEventType.MemberJoined,
    ActivityEventType.MemberLeft,
    ActivityEventType.MemberApproved,
    ActivityEventType.MemberRejected,
    ActivityEventType.RoomCreated,
  ],
}

// REQ: R7 — Threaded comments (200 per thread) with @mentions

/** A mention reference within a comment body. */
export interface Mention {
  /** The member ID being mentioned. */
  memberId: string
  /** Display name at the time of mention (for rendering even if member leaves). */
  displayName: string
  /** Character offset in the comment text where the mention starts. */
  startOffset: number
  /** Character offset in the comment text where the mention ends. */
  endOffset: number
}

/** A single comment within a thread. */
export interface Comment {
  commentId: string
  threadId: string
  roomId: string
  authorId: string           // memberId who wrote the comment
  authorDisplayName: string
  text: string
  mentions: Mention[]
  createdAt: string          // ISO 8601
  updatedAt: string          // ISO 8601
  isEdited: boolean
  isDeleted: boolean         // soft delete for thread integrity
}

/**
 * A comment thread anchored to a whiteboard element.
 * Each element can have at most one thread.
 */
export interface CommentThread {
  threadId: string
  roomId: string
  elementId: string          // the whiteboard element this thread is anchored to
  commentCount: number       // cached count for quick cap checking (max 200)
  createdAt: string          // ISO 8601
  lastCommentAt: string      // ISO 8601 — timestamp of most recent comment
}

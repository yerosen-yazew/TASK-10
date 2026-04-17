// REQ: R8 — Chat (5,000 messages retained, 3 pinned max)

/** A chat message within a room. */
export interface ChatMessage {
  messageId: string
  roomId: string
  authorId: string           // memberId who sent the message
  authorDisplayName: string
  text: string
  mentions: Array<{
    memberId: string
    displayName: string
  }>
  createdAt: string          // ISO 8601
  isDeleted: boolean         // soft delete
}

/** A pinned chat message reference. */
export interface PinnedMessage {
  roomId: string
  messageId: string
  pinnedBy: string           // memberId who pinned it
  pinnedAt: string           // ISO 8601
}

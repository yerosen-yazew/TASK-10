// REQ: R9 — Presence: avatar stack + cursor/name tags

/** Cursor position for a peer's pointer on the canvas. */
export interface CursorPosition {
  x: number
  y: number
  /** Timestamp when this cursor position was captured (for staleness checks). */
  timestamp: number
}

/** Avatar display info for presence stack. */
export interface AvatarInfo {
  memberId: string
  displayName: string
  avatarColor: string
  role: string               // RoomRole value, kept as string for display
}

/** Presence state for a single member in a room. */
export interface PresenceState {
  memberId: string
  roomId: string
  displayName: string
  avatarColor: string
  isOnline: boolean
  cursor: CursorPosition | null
  currentTool: string | null   // the whiteboard tool the user is currently using
  lastSeenAt: string           // ISO 8601
}

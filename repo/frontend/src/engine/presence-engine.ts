// REQ: R9 — Presence: avatar stack + cursor/name tags (ephemeral, in-memory only)

import type { PresenceState, CursorPosition } from '@/models/presence'
import { nowISO } from '@/utils/date-utils'

type RoomPresenceMap = Map<string, PresenceState>
const rooms = new Map<string, RoomPresenceMap>()
const subscribers = new Map<string, Set<(states: PresenceState[]) => void>>()

function getRoomMap(roomId: string): RoomPresenceMap {
  let map = rooms.get(roomId)
  if (!map) {
    map = new Map()
    rooms.set(roomId, map)
  }
  return map
}

function notify(roomId: string): void {
  const subs = subscribers.get(roomId)
  if (!subs) return
  const list = listPresent(roomId)
  for (const fn of subs) fn(list)
}

/** Register or update a member's presence entry. */
export function setPresence(state: PresenceState): void {
  const map = getRoomMap(state.roomId)
  map.set(state.memberId, { ...state, lastSeenAt: nowISO() })
  notify(state.roomId)
}

/** Update a member's cursor position. */
export function updateCursor(
  roomId: string,
  memberId: string,
  cursor: CursorPosition | null
): void {
  const map = getRoomMap(roomId)
  const existing = map.get(memberId)
  if (!existing) return
  map.set(memberId, { ...existing, cursor, lastSeenAt: nowISO() })
  notify(roomId)
}

/** Mark a member as active (online and interactive). */
export function setActive(roomId: string, memberId: string): void {
  const map = getRoomMap(roomId)
  const existing = map.get(memberId)
  if (!existing) return
  map.set(memberId, { ...existing, isOnline: true, lastSeenAt: nowISO() })
  notify(roomId)
}

/** Mark a member as idle (still online but not interacting). */
export function setIdle(roomId: string, memberId: string): void {
  const map = getRoomMap(roomId)
  const existing = map.get(memberId)
  if (!existing) return
  map.set(memberId, { ...existing, isOnline: true, cursor: null, lastSeenAt: nowISO() })
  notify(roomId)
}

/** Remove a member's presence entry (when they leave). */
export function leavePresence(roomId: string, memberId: string): void {
  const map = getRoomMap(roomId)
  if (map.delete(memberId)) notify(roomId)
}

/** List all present members in a room. */
export function listPresent(roomId: string): PresenceState[] {
  const map = rooms.get(roomId)
  if (!map) return []
  return Array.from(map.values())
}

/** Subscribe to presence changes for a room. Returns an unsubscribe function. */
export function subscribe(
  roomId: string,
  handler: (states: PresenceState[]) => void
): () => void {
  let set = subscribers.get(roomId)
  if (!set) {
    set = new Set()
    subscribers.set(roomId, set)
  }
  set.add(handler)
  return () => {
    const s = subscribers.get(roomId)
    if (!s) return
    s.delete(handler)
    if (s.size === 0) subscribers.delete(roomId)
  }
}

/** Reset presence state (for tests or room close). */
export function resetPresence(roomId?: string): void {
  if (roomId === undefined) {
    rooms.clear()
    subscribers.clear()
    return
  }
  rooms.delete(roomId)
  subscribers.delete(roomId)
}

// REQ: R15 — LocalStorage for lightweight preferences and session flags

import { LS_PREFIX } from '@/models/constants'

/** All LocalStorage key suffixes used by ForgeRoom. */
export const LS_KEYS = {
  THEME: `${LS_PREFIX}theme`,
  RECENT_ROOMS: `${LS_PREFIX}recentRooms`,
  LAST_TOOL: `${LS_PREFIX}lastTool`,
  AVATAR_COLOR: `${LS_PREFIX}avatarColor`,
  ACTIVE_PROFILE_ID: `${LS_PREFIX}activeProfileId`,
  SESSION_LOCK_AT: `${LS_PREFIX}sessionLockAt`,
  SIGN_OUT_AT: `${LS_PREFIX}signOutAt`,
} as const

/** Theme preference type. */
export type ThemePreference = 'light' | 'dark'

/** Recent room entry for the recent-rooms list. */
export interface RecentRoomEntry {
  roomId: string
  name: string
  lastAccessed: string // ISO 8601
}

/** Read a string value from LocalStorage. */
export function lsGetString(key: string): string | null {
  return localStorage.getItem(key)
}

/** Write a string value to LocalStorage. */
export function lsSetString(key: string, value: string): void {
  localStorage.setItem(key, value)
}

/** Read and parse a JSON value from LocalStorage. */
export function lsGetJSON<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** Write a JSON value to LocalStorage. */
export function lsSetJSON<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

/** Remove a key from LocalStorage. */
export function lsRemove(key: string): void {
  localStorage.removeItem(key)
}

/** Clear all ForgeRoom keys from LocalStorage. */
export function lsClearAll(): void {
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(LS_PREFIX)) {
      keysToRemove.push(key)
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key)
  }
}

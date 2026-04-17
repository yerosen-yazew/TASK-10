// REQ: R13 — 30-minute inactivity lock and 8-hour forced sign-out
// Session timestamps are written to LocalStorage so timers survive page reloads.
// In-memory timers fire events when the app is open and the deadline is reached.

import { INACTIVITY_LOCK_MS, FORCED_SIGNOUT_MS } from '@/models/constants'
import { LS_KEYS, lsGetString, lsSetString, lsRemove } from './local-storage-keys'
import { SessionState } from '@/models/profile'
import { logger } from '@/utils/logger'

/** Callback invoked when session state changes due to timer expiry. */
type SessionChangeCallback = (state: SessionState) => void
let onSessionChange: SessionChangeCallback | null = null

/** In-memory timer handles. Cleared and reset on each unlock/activity. */
let inactivityTimer: ReturnType<typeof setTimeout> | null = null
let forcedSignOutTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Register a callback to receive session state transitions triggered by timers.
 * Only one callback is supported; calling again replaces the previous one.
 */
export function onSessionStateChange(callback: SessionChangeCallback): void {
  onSessionChange = callback
}

/**
 * Inspect LocalStorage timestamps on app load/reload and determine the correct
 * initial session state without starting new timers.
 */
export function checkSessionOnLoad(): SessionState {
  const profileId = lsGetString(LS_KEYS.ACTIVE_PROFILE_ID)
  if (!profileId) return SessionState.NoProfile

  const signOutAt = lsGetString(LS_KEYS.SIGN_OUT_AT)
  if (signOutAt && new Date(signOutAt).getTime() <= Date.now()) {
    logger.info('Session: forced sign-out deadline already passed on load')
    clearSessionStorage()
    return SessionState.ForcedSignOut
  }

  const lockAt = lsGetString(LS_KEYS.SESSION_LOCK_AT)
  if (lockAt && new Date(lockAt).getTime() <= Date.now()) {
    logger.info('Session: inactivity lock deadline already passed on load')
    return SessionState.InactivityLocked
  }

  return SessionState.Active
}

/**
 * Write session timestamps to LocalStorage immediately after a successful unlock.
 * Timestamps are absolute ISO deadlines, not durations, so they survive tab switches.
 */
export function writeSessionToStorage(profileId: string): void {
  const now = Date.now()
  const lockAt = new Date(now + INACTIVITY_LOCK_MS).toISOString()
  const signOutAt = new Date(now + FORCED_SIGNOUT_MS).toISOString()

  lsSetString(LS_KEYS.ACTIVE_PROFILE_ID, profileId)
  lsSetString(LS_KEYS.SESSION_LOCK_AT, lockAt)
  lsSetString(LS_KEYS.SIGN_OUT_AT, signOutAt)
}

/**
 * Remove all session-related LocalStorage flags.
 * Called on sign-out or forced-sign-out.
 */
export function clearSessionStorage(): void {
  lsRemove(LS_KEYS.ACTIVE_PROFILE_ID)
  lsRemove(LS_KEYS.SESSION_LOCK_AT)
  lsRemove(LS_KEYS.SIGN_OUT_AT)
}

/**
 * Start both session timers after a successful unlock.
 * Timers are calculated from stored deadlines so they are consistent with
 * what other tabs see from LocalStorage.
 */
export function startSessionTimers(profileId: string): void {
  clearSessionTimers()
  writeSessionToStorage(profileId)

  const now = Date.now()

  const signOutAtStr = lsGetString(LS_KEYS.SIGN_OUT_AT)
  const lockAtStr = lsGetString(LS_KEYS.SESSION_LOCK_AT)

  const signOutMs = signOutAtStr
    ? Math.max(0, new Date(signOutAtStr).getTime() - now)
    : FORCED_SIGNOUT_MS

  const lockMs = lockAtStr
    ? Math.max(0, new Date(lockAtStr).getTime() - now)
    : INACTIVITY_LOCK_MS

  if (signOutMs > 0) {
    forcedSignOutTimer = setTimeout(() => {
      logger.info('Session: forced sign-out timer fired')
      clearSessionStorage()
      onSessionChange?.(SessionState.ForcedSignOut)
    }, signOutMs)
  }

  if (lockMs > 0) {
    inactivityTimer = setTimeout(() => {
      logger.info('Session: inactivity lock timer fired')
      onSessionChange?.(SessionState.InactivityLocked)
    }, lockMs)
  }
}

/**
 * Reset the inactivity timer on user activity.
 * Only effective if the session is currently Active and the forced sign-out
 * deadline has not yet passed.
 */
export function resetInactivityTimer(): void {
  const profileId = lsGetString(LS_KEYS.ACTIVE_PROFILE_ID)
  if (!profileId) return

  const signOutAtStr = lsGetString(LS_KEYS.SIGN_OUT_AT)
  if (!signOutAtStr || new Date(signOutAtStr).getTime() <= Date.now()) return

  // Extend the inactivity lock deadline
  const newLockAt = new Date(Date.now() + INACTIVITY_LOCK_MS).toISOString()
  lsSetString(LS_KEYS.SESSION_LOCK_AT, newLockAt)

  // Restart the in-memory inactivity timer
  if (inactivityTimer) clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(() => {
    logger.info('Session: inactivity lock timer fired (after reset)')
    onSessionChange?.(SessionState.InactivityLocked)
  }, INACTIVITY_LOCK_MS)
}

/**
 * Restart session timers from existing LocalStorage deadlines (used after reload
 * when the session was found to still be Active).
 */
export function resumeSessionTimers(): void {
  const now = Date.now()

  const signOutAtStr = lsGetString(LS_KEYS.SIGN_OUT_AT)
  const lockAtStr = lsGetString(LS_KEYS.SESSION_LOCK_AT)

  if (!signOutAtStr || !lockAtStr) return

  const signOutMs = Math.max(0, new Date(signOutAtStr).getTime() - now)
  const lockMs = Math.max(0, new Date(lockAtStr).getTime() - now)

  clearSessionTimers()

  if (signOutMs > 0) {
    forcedSignOutTimer = setTimeout(() => {
      logger.info('Session: forced sign-out timer fired (resumed)')
      clearSessionStorage()
      onSessionChange?.(SessionState.ForcedSignOut)
    }, signOutMs)
  }

  if (lockMs > 0) {
    inactivityTimer = setTimeout(() => {
      logger.info('Session: inactivity lock timer fired (resumed)')
      onSessionChange?.(SessionState.InactivityLocked)
    }, lockMs)
  }
}

/** Clear all in-memory session timers. Does not affect LocalStorage state. */
export function clearSessionTimers(): void {
  if (inactivityTimer !== null) {
    clearTimeout(inactivityTimer)
    inactivityTimer = null
  }
  if (forcedSignOutTimer !== null) {
    clearTimeout(forcedSignOutTimer)
    forcedSignOutTimer = null
  }
}

/** Returns milliseconds remaining until forced sign-out, or 0 if expired/unset. */
export function getRemainingSignOutMs(): number {
  const signOutAtStr = lsGetString(LS_KEYS.SIGN_OUT_AT)
  if (!signOutAtStr) return 0
  return Math.max(0, new Date(signOutAtStr).getTime() - Date.now())
}

/** Returns milliseconds remaining until inactivity lock, or 0 if expired/unset. */
export function getRemainingLockMs(): number {
  const lockAtStr = lsGetString(LS_KEYS.SESSION_LOCK_AT)
  if (!lockAtStr) return 0
  return Math.max(0, new Date(lockAtStr).getTime() - Date.now())
}

// REQ: R13 — Session timer logic, inactivity lock, forced sign-out, reload recovery

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  checkSessionOnLoad,
  writeSessionToStorage,
  clearSessionStorage,
  startSessionTimers,
  clearSessionTimers,
  onSessionStateChange,
  getRemainingSignOutMs,
  getRemainingLockMs,
  resetInactivityTimer,
} from '@/services/session-service'
import { SessionState } from '@/models/profile'
import { INACTIVITY_LOCK_MS, FORCED_SIGNOUT_MS } from '@/models/constants'

// ── LocalStorage mock ─────────────────────────────────────────────────────────
const lsStore: Record<string, string> = {}

const localStorageMock = {
  getItem: (key: string) => lsStore[key] ?? null,
  setItem: (key: string, value: string) => { lsStore[key] = value },
  removeItem: (key: string) => { delete lsStore[key] },
  clear: () => { Object.keys(lsStore).forEach((k) => delete lsStore[k]) },
  key: (i: number) => Object.keys(lsStore)[i] ?? null,
  get length() { return Object.keys(lsStore).length },
}

beforeEach(() => {
  Object.keys(lsStore).forEach((k) => delete lsStore[k])
  vi.stubGlobal('localStorage', localStorageMock)
  clearSessionTimers()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllTimers()
  clearSessionTimers()
})

// ── checkSessionOnLoad ────────────────────────────────────────────────────────

describe('checkSessionOnLoad', () => {
  it('returns NoProfile when no active profile is stored', () => {
    expect(checkSessionOnLoad()).toBe(SessionState.NoProfile)
  })

  it('returns Active when timestamps are in the future', () => {
    const now = Date.now()
    lsStore['forgeroom:activeProfileId'] = 'p1'
    lsStore['forgeroom:sessionLockAt'] = new Date(now + INACTIVITY_LOCK_MS).toISOString()
    lsStore['forgeroom:signOutAt'] = new Date(now + FORCED_SIGNOUT_MS).toISOString()

    expect(checkSessionOnLoad()).toBe(SessionState.Active)
  })

  it('returns InactivityLocked when lock timestamp is in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    lsStore['forgeroom:activeProfileId'] = 'p1'
    lsStore['forgeroom:sessionLockAt'] = past
    lsStore['forgeroom:signOutAt'] = new Date(Date.now() + FORCED_SIGNOUT_MS).toISOString()

    expect(checkSessionOnLoad()).toBe(SessionState.InactivityLocked)
  })

  it('returns ForcedSignOut when sign-out timestamp is in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    lsStore['forgeroom:activeProfileId'] = 'p1'
    lsStore['forgeroom:sessionLockAt'] = new Date(Date.now() + INACTIVITY_LOCK_MS).toISOString()
    lsStore['forgeroom:signOutAt'] = past

    const state = checkSessionOnLoad()
    expect(state).toBe(SessionState.ForcedSignOut)
    // Storage must be cleared on forced sign-out
    expect(lsStore['forgeroom:activeProfileId']).toBeUndefined()
  })
})

// ── writeSessionToStorage / clearSessionStorage ───────────────────────────────

describe('writeSessionToStorage', () => {
  it('sets all three LocalStorage keys', () => {
    writeSessionToStorage('p1')
    expect(lsStore['forgeroom:activeProfileId']).toBe('p1')
    expect(lsStore['forgeroom:sessionLockAt']).toBeTruthy()
    expect(lsStore['forgeroom:signOutAt']).toBeTruthy()
  })

  it('sets lockAt approximately INACTIVITY_LOCK_MS from now', () => {
    const before = Date.now()
    writeSessionToStorage('p1')
    const lockAt = new Date(lsStore['forgeroom:sessionLockAt']).getTime()
    expect(lockAt).toBeGreaterThanOrEqual(before + INACTIVITY_LOCK_MS - 100)
    expect(lockAt).toBeLessThanOrEqual(before + INACTIVITY_LOCK_MS + 1000)
  })

  it('sets signOutAt approximately FORCED_SIGNOUT_MS from now', () => {
    const before = Date.now()
    writeSessionToStorage('p1')
    const signOutAt = new Date(lsStore['forgeroom:signOutAt']).getTime()
    expect(signOutAt).toBeGreaterThanOrEqual(before + FORCED_SIGNOUT_MS - 100)
    expect(signOutAt).toBeLessThanOrEqual(before + FORCED_SIGNOUT_MS + 1000)
  })
})

describe('clearSessionStorage', () => {
  it('removes all session keys', () => {
    writeSessionToStorage('p1')
    clearSessionStorage()
    expect(lsStore['forgeroom:activeProfileId']).toBeUndefined()
    expect(lsStore['forgeroom:sessionLockAt']).toBeUndefined()
    expect(lsStore['forgeroom:signOutAt']).toBeUndefined()
  })
})

// ── Timer-driven state changes ────────────────────────────────────────────────

describe('startSessionTimers', () => {
  it('fires inactivity lock callback after lock delay', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    onSessionStateChange(callback)

    startSessionTimers('p1')
    vi.advanceTimersByTime(INACTIVITY_LOCK_MS + 100)

    expect(callback).toHaveBeenCalledWith(SessionState.InactivityLocked)
    vi.useRealTimers()
  })

  it('fires forced sign-out callback after sign-out delay', () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    onSessionStateChange(callback)

    startSessionTimers('p1')
    vi.advanceTimersByTime(FORCED_SIGNOUT_MS + 100)

    expect(callback).toHaveBeenCalledWith(SessionState.ForcedSignOut)
    vi.useRealTimers()
  })
})

// ── resetInactivityTimer ──────────────────────────────────────────────────────

describe('resetInactivityTimer', () => {
  it('extends the lock-at timestamp in LocalStorage', () => {
    writeSessionToStorage('p1')
    const before = new Date(lsStore['forgeroom:sessionLockAt']).getTime()

    // Small delay then reset
    resetInactivityTimer()

    const after = new Date(lsStore['forgeroom:sessionLockAt']).getTime()
    expect(after).toBeGreaterThanOrEqual(before)
  })

  it('does nothing if no active profile is stored', () => {
    // No active profile in storage
    expect(() => resetInactivityTimer()).not.toThrow()
  })
})

// ── getRemainingMs ────────────────────────────────────────────────────────────

describe('getRemainingSignOutMs', () => {
  it('returns 0 when no key is set', () => {
    expect(getRemainingSignOutMs()).toBe(0)
  })

  it('returns positive value for future deadline', () => {
    lsStore['forgeroom:signOutAt'] = new Date(Date.now() + 60_000).toISOString()
    expect(getRemainingSignOutMs()).toBeGreaterThan(0)
  })

  it('returns 0 for past deadline', () => {
    lsStore['forgeroom:signOutAt'] = new Date(Date.now() - 1000).toISOString()
    expect(getRemainingSignOutMs()).toBe(0)
  })
})

describe('getRemainingLockMs', () => {
  it('returns 0 when no key is set', () => {
    expect(getRemainingLockMs()).toBe(0)
  })

  it('returns positive value for future deadline', () => {
    lsStore['forgeroom:sessionLockAt'] = new Date(Date.now() + 60_000).toISOString()
    expect(getRemainingLockMs()).toBeGreaterThan(0)
  })
})

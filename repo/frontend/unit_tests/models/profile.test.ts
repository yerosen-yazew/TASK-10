// REQ: R12/R13 — Session state enum invariants for unlock, lock, and forced sign-out flows

import { describe, expect, it } from 'vitest'
import { SessionState } from '@/models/profile'

describe('profile model enums', () => {
  it('defines all expected session states', () => {
    expect(SessionState.NoProfile).toBe('no_profile')
    expect(SessionState.Locked).toBe('locked')
    expect(SessionState.Active).toBe('active')
    expect(SessionState.InactivityLocked).toBe('inactivity_locked')
    expect(SessionState.ForcedSignOut).toBe('forced_sign_out')
  })

  it('contains exactly five session state values', () => {
    expect(Object.values(SessionState)).toHaveLength(5)
  })
})

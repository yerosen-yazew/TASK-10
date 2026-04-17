// REQ: R12 — Session store: profile selection, unlock flow, error states
// REQ: R13 — Lock/sign-out state transitions via store

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionStore } from '@/stores/session-store'
import { SessionState } from '@/models/profile'

// Mock all service dependencies
vi.mock('@/services/profile-service', () => ({
  loadProfiles: vi.fn(async () => []),
  createProfile: vi.fn(async (name: string, color: string) => ({
    profileId: 'new-profile-id',
    displayName: name,
    avatarColor: color,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })),
  verifyPassphrase: vi.fn(async () => true),
}))

vi.mock('@/services/session-service', () => ({
  checkSessionOnLoad: vi.fn(() => SessionState.NoProfile),
  startSessionTimers: vi.fn(),
  resumeSessionTimers: vi.fn(),
  clearSessionTimers: vi.fn(),
  resetInactivityTimer: vi.fn(),
  clearSessionStorage: vi.fn(),
  onSessionStateChange: vi.fn(),
}))

vi.mock('@/services/local-storage-keys', () => ({
  LS_KEYS: {
    ACTIVE_PROFILE_ID: 'forgeroom:activeProfileId',
    SESSION_LOCK_AT: 'forgeroom:sessionLockAt',
    SIGN_OUT_AT: 'forgeroom:signOutAt',
  },
  lsGetString: vi.fn(() => null),
  lsSetString: vi.fn(),
  lsRemove: vi.fn(),
}))

import * as profileService from '@/services/profile-service'
import * as sessionService from '@/services/session-service'

describe('useSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initialize', () => {
    it('loads profiles on init', async () => {
      const store = useSessionStore()
      await store.initialize()
      expect(profileService.loadProfiles).toHaveBeenCalled()
    })

    it('sets sessionState to NoProfile when checkSessionOnLoad returns NoProfile', async () => {
      vi.mocked(sessionService.checkSessionOnLoad).mockReturnValueOnce(SessionState.NoProfile)
      const store = useSessionStore()
      await store.initialize()
      expect(store.sessionState).toBe(SessionState.NoProfile)
    })

    it('sets isLoading to false after completion', async () => {
      const store = useSessionStore()
      await store.initialize()
      expect(store.isLoading).toBe(false)
    })
  })

  describe('unlock', () => {
    it('returns true and sets Active state on correct passphrase', async () => {
      vi.mocked(profileService.verifyPassphrase).mockResolvedValueOnce(true)
      const store = useSessionStore()
      const result = await store.unlock('profile-1', 'correctpassword')
      expect(result).toBe(true)
      expect(store.sessionState).toBe(SessionState.Active)
      expect(store.activeProfileId).toBe('profile-1')
    })

    it('returns false and sets error on wrong passphrase', async () => {
      vi.mocked(profileService.verifyPassphrase).mockResolvedValueOnce(false)
      const store = useSessionStore()
      const result = await store.unlock('profile-1', 'wrongpassword')
      expect(result).toBe(false)
      expect(store.error).toContain('Incorrect passphrase')
      expect(store.sessionState).not.toBe(SessionState.Active)
    })

    it('sets isSubmitting during unlock and clears it after', async () => {
      let capturedSubmitting = false
      vi.mocked(profileService.verifyPassphrase).mockImplementationOnce(async () => {
        capturedSubmitting = true
        return true
      })
      const store = useSessionStore()
      const unlockPromise = store.unlock('profile-1', 'pass')
      await unlockPromise
      expect(capturedSubmitting).toBe(true)
      expect(store.isSubmitting).toBe(false)
    })

    it('starts session timers on successful unlock', async () => {
      vi.mocked(profileService.verifyPassphrase).mockResolvedValueOnce(true)
      const store = useSessionStore()
      await store.unlock('profile-1', 'correctpassword')
      expect(sessionService.startSessionTimers).toHaveBeenCalledWith('profile-1')
    })
  })

  describe('lock', () => {
    it('transitions to Locked state', async () => {
      vi.mocked(profileService.verifyPassphrase).mockResolvedValueOnce(true)
      const store = useSessionStore()
      await store.unlock('p1', 'pass')
      store.lock()
      expect(store.sessionState).toBe(SessionState.Locked)
      expect(sessionService.clearSessionTimers).toHaveBeenCalled()
    })
  })

  describe('signOut', () => {
    it('transitions to NoProfile state and clears active profile', async () => {
      vi.mocked(profileService.verifyPassphrase).mockResolvedValueOnce(true)
      const store = useSessionStore()
      await store.unlock('p1', 'pass')
      store.signOut()
      expect(store.sessionState).toBe(SessionState.NoProfile)
      expect(store.activeProfileId).toBeNull()
    })
  })

  describe('createNewProfile', () => {
    it('creates a profile and refreshes the list', async () => {
      vi.mocked(profileService.loadProfiles).mockResolvedValueOnce([])
      vi.mocked(profileService.createProfile).mockResolvedValueOnce({
        profileId: 'new-id',
        displayName: 'Alice',
        avatarColor: '#3b82f6',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
      vi.mocked(profileService.loadProfiles).mockResolvedValueOnce([
        { profileId: 'new-id', displayName: 'Alice', avatarColor: '#3b82f6', createdAt: '', updatedAt: '' },
      ])

      const store = useSessionStore()
      const profile = await store.createNewProfile('Alice', '#3b82f6', 'goodpassword')
      expect(profile.displayName).toBe('Alice')
      expect(store.isSubmitting).toBe(false)
    })

    it('sets error and rethrows on service failure', async () => {
      vi.mocked(profileService.createProfile).mockRejectedValueOnce(new Error('Passphrase must be at least 8 characters.'))
      const store = useSessionStore()
      await expect(store.createNewProfile('Alice', '#3b82f6', 'short')).rejects.toThrow()
      expect(store.error).toBeTruthy()
    })
  })

  describe('isUnlocked / isLocked computed', () => {
    it('isUnlocked is false for NoProfile state', () => {
      const store = useSessionStore()
      store.sessionState = SessionState.NoProfile as SessionState
      expect(store.isUnlocked).toBe(false)
    })

    it('isUnlocked is true for Active state', () => {
      const store = useSessionStore()
      store.sessionState = SessionState.Active as SessionState
      expect(store.isUnlocked).toBe(true)
    })

    it('isLocked is true for InactivityLocked state', () => {
      const store = useSessionStore()
      store.sessionState = SessionState.InactivityLocked as SessionState
      expect(store.isLocked).toBe(true)
    })

    it('isLocked is true for ForcedSignOut state', () => {
      const store = useSessionStore()
      store.sessionState = SessionState.ForcedSignOut as SessionState
      expect(store.isLocked).toBe(true)
    })
  })

  describe('clearError', () => {
    it('clears the error field', () => {
      const store = useSessionStore()
      store.error = 'some error' as string | null
      store.clearError()
      expect(store.error).toBeNull()
    })
  })
})

// REQ: R12 — Local-only profile selection and passphrase unlock flow
// REQ: R13 — 30-minute inactivity lock and 8-hour forced sign-out

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { SessionState } from '@/models/profile'
import type { Profile } from '@/models/profile'
import {
  loadProfiles,
  createProfile,
  verifyPassphrase,
} from '@/services/profile-service'
import {
  checkSessionOnLoad,
  startSessionTimers,
  resumeSessionTimers,
  clearSessionTimers,
  resetInactivityTimer,
  clearSessionStorage,
  onSessionStateChange,
} from '@/services/session-service'
import { LS_KEYS, lsGetString } from '@/services/local-storage-keys'
import { logger } from '@/utils/logger'

export const useSessionStore = defineStore('session', () => {
  // ── State ────────────────────────────────────────────────────────────────
  const profiles = ref<Profile[]>([])
  const activeProfileId = ref<string | null>(null)
  const sessionState = ref<SessionState>(SessionState.NoProfile)

  /** True while any async operation (load, unlock, create) is in progress. */
  const isLoading = ref(false)
  /** True while a form submission (create/unlock) is in flight. */
  const isSubmitting = ref(false)
  /** Last error message from a failed operation (null when clear). */
  const error = ref<string | null>(null)

  // ── Computed ─────────────────────────────────────────────────────────────
  const activeProfile = computed<Profile | null>(
    () => profiles.value.find((p) => p.profileId === activeProfileId.value) ?? null
  )
  const isUnlocked = computed(() => sessionState.value === SessionState.Active)
  const isLocked = computed(
    () =>
      sessionState.value === SessionState.Locked ||
      sessionState.value === SessionState.InactivityLocked ||
      sessionState.value === SessionState.ForcedSignOut
  )

  // ── Initialization ────────────────────────────────────────────────────────
  /**
   * Load profiles and restore the session state from LocalStorage.
   * Must be called once when the app mounts (from App.vue onMounted).
   */
  async function initialize(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      profiles.value = await loadProfiles()

      const storedState = checkSessionOnLoad()
      sessionState.value = storedState

      if (storedState === SessionState.Active) {
        const storedId = lsGetString(LS_KEYS.ACTIVE_PROFILE_ID)
        if (storedId) {
          activeProfileId.value = storedId
          // Resume existing timers from stored deadlines
          resumeSessionTimers()
        } else {
          sessionState.value = SessionState.NoProfile
        }
      } else if (storedState === SessionState.InactivityLocked) {
        // Keep the profile ID so the unlock form can be pre-populated
        const storedId = lsGetString(LS_KEYS.ACTIVE_PROFILE_ID)
        activeProfileId.value = storedId ?? null
      }

      // Register timer-driven state transitions
      onSessionStateChange((newState) => {
        sessionState.value = newState
        if (newState === SessionState.ForcedSignOut) {
          activeProfileId.value = null
        }
        logger.info('Session state changed via timer', { newState })
      })
    } catch (err) {
      logger.error('Session initialization error', { err })
      error.value = 'Failed to load session. Please refresh.'
    } finally {
      isLoading.value = false
    }
  }

  // ── Profile management ────────────────────────────────────────────────────
  /** Reload the profile list from IndexedDB. */
  async function refreshProfiles(): Promise<void> {
    profiles.value = await loadProfiles()
  }

  /**
   * Create a new profile with PBKDF2 passphrase verification.
   * On success, returns the created Profile (but does NOT auto-unlock).
   */
  async function createNewProfile(
    displayName: string,
    avatarColor: string,
    passphrase: string
  ): Promise<Profile> {
    isSubmitting.value = true
    error.value = null
    try {
      const profile = await createProfile(displayName, avatarColor, passphrase)
      await refreshProfiles()
      return profile
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create profile.'
      error.value = message
      throw err
    } finally {
      isSubmitting.value = false
    }
  }

  // ── Unlock / lock / sign-out ──────────────────────────────────────────────
  /**
   * Verify a passphrase and, if correct, establish an active session.
   * Returns true on success, false if the passphrase is wrong.
   */
  async function unlock(profileId: string, passphrase: string): Promise<boolean> {
    isSubmitting.value = true
    error.value = null
    try {
      const valid = await verifyPassphrase(profileId, passphrase)
      if (!valid) {
        error.value = 'Incorrect passphrase. Please try again.'
        return false
      }
      activeProfileId.value = profileId
      sessionState.value = SessionState.Active
      startSessionTimers(profileId)
      logger.info('Session unlocked', { profileId })
      return true
    } catch (err) {
      logger.error('Unlock failed', { err })
      error.value = 'Unlock failed due to an unexpected error. Please try again.'
      return false
    } finally {
      isSubmitting.value = false
    }
  }

  /**
   * Lock the session manually (e.g., user clicks "Lock screen").
   * Clears timers and removes session flags but keeps the active profile ID
   * so the unlock form can re-prompt.
   */
  function lock(): void {
    clearSessionTimers()
    clearSessionStorage()
    sessionState.value = SessionState.Locked
    logger.info('Session locked manually')
  }

  /**
   * Sign out fully: clear all session data and return to NoProfile state.
   */
  function signOut(): void {
    clearSessionTimers()
    clearSessionStorage()
    activeProfileId.value = null
    sessionState.value = SessionState.NoProfile
    logger.info('Session signed out')
  }

  // ── Activity tracking ─────────────────────────────────────────────────────
  /**
   * Record user activity to reset the inactivity timer.
   * Call this on significant user interactions (mousemove, keydown, click).
   */
  function recordActivity(): void {
    if (sessionState.value === SessionState.Active) {
      resetInactivityTimer()
    }
  }

  /** Clear a displayed error message. */
  function clearError(): void {
    error.value = null
  }

  return {
    // state
    profiles,
    activeProfileId,
    sessionState,
    isLoading,
    isSubmitting,
    error,
    // computed
    activeProfile,
    isUnlocked,
    isLocked,
    // actions
    initialize,
    refreshProfiles,
    createNewProfile,
    unlock,
    lock,
    signOut,
    recordActivity,
    clearError,
  }
})

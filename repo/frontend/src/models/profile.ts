// REQ: R12 — Local-only profile selection with passphrase (min 8 chars)
// REQ: R13 — 30-min inactivity lock, 8-hr forced sign-out

/** A locally stored user profile. */
export interface Profile {
  profileId: string
  displayName: string
  avatarColor: string
  createdAt: string // ISO 8601
  updatedAt: string // ISO 8601
}

/**
 * Passphrase verifier stored per profile.
 * The raw passphrase is NEVER persisted. Only the salt and derived verifier are stored.
 * Uses PBKDF2-HMAC-SHA-256 via Web Crypto API.
 */
export interface PassphraseVerifier {
  profileId: string
  salt: string       // base64-encoded random salt
  verifier: string   // base64-encoded PBKDF2 output
  iterations: number // PBKDF2 iteration count
}

/** Session state enum for the local unlock flow. */
export enum SessionState {
  /** No profile selected. */
  NoProfile = 'no_profile',
  /** Profile selected but locked (passphrase required). */
  Locked = 'locked',
  /** Profile unlocked and active. */
  Active = 'active',
  /** Session timed out due to inactivity (30-min lock). */
  InactivityLocked = 'inactivity_locked',
  /** Forced sign-out after 8 hours. */
  ForcedSignOut = 'forced_sign_out',
}

/** Active unlock session tracked in memory and LocalStorage flags. */
export interface UnlockSession {
  profileId: string
  state: SessionState
  unlockedAt: string       // ISO 8601 — when the session was unlocked
  lastActivityAt: string   // ISO 8601 — last user interaction timestamp
  signOutAt: string        // ISO 8601 — forced sign-out deadline
}

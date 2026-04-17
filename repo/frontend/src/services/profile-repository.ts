// REQ: R12 — Profile and passphrase verifier persistence (IndexedDB)

import { BaseRepository } from './base-repository'
import type { Profile, PassphraseVerifier } from '@/models/profile'

/**
 * Repository for local user profiles.
 * Profiles do NOT include passphrase material — only display info.
 */
class ProfileRepository extends BaseRepository<Profile, string> {
  protected readonly storeName = 'profiles'
}

/**
 * Repository for passphrase verifiers.
 * Stores salt and PBKDF2-derived verifier. The raw passphrase is never persisted.
 */
class PassphraseVerifierRepository extends BaseRepository<PassphraseVerifier, string> {
  protected readonly storeName = 'passphraseVerifiers'
}

/** Singleton profile repository. */
export const profileRepository = new ProfileRepository()

/** Singleton passphrase verifier repository. */
export const passphraseVerifierRepository = new PassphraseVerifierRepository()

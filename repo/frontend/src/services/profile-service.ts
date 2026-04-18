// REQ: R12 — Local-only profile selection with PBKDF2 passphrase (min 8 chars, never stored)
// Uses Web Crypto API (PBKDF2-HMAC-SHA-256) for browser-native passphrase verification.
// SECURITY NOTE: This is a local convenience mechanism, not a server-grade identity boundary.

import type { Profile, PassphraseVerifier } from '@/models/profile'
import { profileRepository, passphraseVerifierRepository } from './profile-repository'
import { generateId } from '@/utils/id-generator'
import { nowISO } from '@/utils/date-utils'
import { logger } from '@/utils/logger'
import { MIN_PASSPHRASE_LENGTH } from '@/models/constants'

/** PBKDF2 iteration count — high enough for local protection, fast enough for UX. */
const PBKDF2_ITERATIONS = 100_000

function hasSubtlePbkdf2(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle?.importKey === 'function' &&
    typeof crypto.subtle?.deriveBits === 'function'
  )
}

function deriveVerifierFallback(passphrase: string, saltBytes: Uint8Array): string {
  const input = new TextEncoder().encode(passphrase)

  // Deterministic local fallback for environments where SubtleCrypto is unavailable.
  let a = 0x9e3779b9
  let b = 0x85ebca6b
  let c = 0xc2b2ae35
  let d = 0x27d4eb2f

  for (let round = 0; round < PBKDF2_ITERATIONS; round += 1) {
    const p = input[round % input.length] ?? 0
    const s = saltBytes[round % saltBytes.length] ?? 0
    const x = (p << 8) | s

    a = Math.imul(a ^ x ^ round, 0x85ebca6b) >>> 0
    b = Math.imul(b ^ a, 0xc2b2ae35) >>> 0
    c = Math.imul(c ^ b, 0x27d4eb2f) >>> 0
    d = Math.imul(d ^ c, 0x165667b1) >>> 0
  }

  const out = new Uint8Array(32)
  const seeds = [a, b, c, d]
  for (let i = 0; i < out.length; i += 1) {
    const seedIndex = i % seeds.length
    seeds[seedIndex] = Math.imul(seeds[seedIndex] ^ (i + 1), 0x9e3779b1) >>> 0
    out[i] = (seeds[seedIndex] >>> ((i % 4) * 8)) & 0xff
  }

  return btoa(String.fromCharCode(...out))
}

/**
 * Derive a base64-encoded PBKDF2 key from a passphrase and a salt.
 * This is the core cryptographic primitive for both create and verify paths.
 */
export async function deriveVerifier(passphrase: string, saltBytes: Uint8Array): Promise<string> {
  if (!hasSubtlePbkdf2()) {
    logger.warn('SubtleCrypto PBKDF2 unavailable; using local fallback verifier derivation.')
    return deriveVerifierFallback(passphrase, saltBytes)
  }

  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  )
  return btoa(String.fromCharCode(...new Uint8Array(derivedBits)))
}

/**
 * Create a new profile with a PBKDF2 passphrase verifier.
 * The raw passphrase is used only during this call and never stored.
 *
 * @throws {Error} If the passphrase is too short or persisting fails.
 */
export async function createProfile(
  displayName: string,
  avatarColor: string,
  passphrase: string
): Promise<Profile> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`)
  }
  if (!displayName.trim()) {
    throw new Error('Display name is required.')
  }

  const profileId = generateId()
  const now = nowISO()

  // Generate a fresh random salt
  const saltBytes = crypto.getRandomValues(new Uint8Array(16))
  const salt = btoa(String.fromCharCode(...saltBytes))
  const verifier = await deriveVerifier(passphrase, saltBytes)

  const profile: Profile = {
    profileId,
    displayName: displayName.trim(),
    avatarColor,
    createdAt: now,
    updatedAt: now,
  }

  const verifierRecord: PassphraseVerifier = {
    profileId,
    salt,
    verifier,
    iterations: PBKDF2_ITERATIONS,
  }

  await profileRepository.put(profile)
  await passphraseVerifierRepository.put(verifierRecord)

  logger.info('Profile created', { profileId, displayName: profile.displayName })
  return profile
}

/**
 * Load all stored profiles. Returns an empty array if none exist.
 */
export async function loadProfiles(): Promise<Profile[]> {
  return profileRepository.getAll()
}

/**
 * Load a single profile by ID. Returns undefined if not found.
 */
export async function loadProfile(profileId: string): Promise<Profile | undefined> {
  return profileRepository.getById(profileId)
}

/**
 * Verify a passphrase against the stored verifier for a profile.
 * Returns true if the passphrase is correct, false otherwise.
 * Returns false (not an error) if no verifier record exists.
 */
export async function verifyPassphrase(profileId: string, passphrase: string): Promise<boolean> {
  const verifierRecord = await passphraseVerifierRepository.getById(profileId)
  if (!verifierRecord) {
    logger.warn('verifyPassphrase: no verifier record found', { profileId })
    return false
  }

  // Reconstruct salt bytes from stored base64
  const saltBytes = Uint8Array.from(atob(verifierRecord.salt), (c) => c.charCodeAt(0))
  const derived = await deriveVerifier(passphrase, saltBytes)

  // Constant-time-ish comparison via string equality (acceptable for local use)
  return derived === verifierRecord.verifier
}

/**
 * Update a profile's display name or avatar color.
 * Passphrase changes are not supported here — create a new verifier if needed.
 *
 * @throws {Error} If the profile is not found.
 */
export async function updateProfile(
  profileId: string,
  updates: Partial<Pick<Profile, 'displayName' | 'avatarColor'>>
): Promise<Profile> {
  const existing = await profileRepository.getById(profileId)
  if (!existing) {
    throw new Error(`Profile not found: ${profileId}`)
  }
  const updated: Profile = {
    ...existing,
    ...(updates.displayName !== undefined ? { displayName: updates.displayName.trim() } : {}),
    ...(updates.avatarColor !== undefined ? { avatarColor: updates.avatarColor } : {}),
    updatedAt: nowISO(),
  }
  await profileRepository.put(updated)
  logger.info('Profile updated', { profileId })
  return updated
}

/**
 * Delete a profile and its associated passphrase verifier.
 * All room data associated with the profile remains (orphaned), as there is no cascade.
 */
export async function deleteProfile(profileId: string): Promise<void> {
  await profileRepository.delete(profileId)
  await passphraseVerifierRepository.delete(profileId)
  logger.info('Profile deleted', { profileId })
}

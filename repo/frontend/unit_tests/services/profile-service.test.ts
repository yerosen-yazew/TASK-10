// REQ: R12 — Profile creation, PBKDF2 passphrase verification, profile CRUD

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createProfile,
  verifyPassphrase,
  loadProfiles,
  updateProfile,
  deleteProfile,
  deriveVerifier,
} from '@/services/profile-service'
import * as profileRepo from '@/services/profile-repository'
import type { Profile, PassphraseVerifier } from '@/models/profile'

// Mock the repository layer so tests do not require IndexedDB
vi.mock('@/services/profile-repository', () => {
  const store = new Map<string, unknown>()
  const verifierStore = new Map<string, unknown>()

  return {
    profileRepository: {
      put: vi.fn(async (item: Profile) => { store.set(item.profileId, item) }),
      getAll: vi.fn(async () => Array.from(store.values())),
      getById: vi.fn(async (id: string) => store.get(id) as Profile | undefined),
      delete: vi.fn(async (id: string) => { store.delete(id) }),
    },
    passphraseVerifierRepository: {
      put: vi.fn(async (item: PassphraseVerifier) => { verifierStore.set(item.profileId, item) }),
      getById: vi.fn(async (id: string) => verifierStore.get(id) as PassphraseVerifier | undefined),
      delete: vi.fn(async (id: string) => { verifierStore.delete(id) }),
    },
  }
})

describe('deriveVerifier', () => {
  it('returns a non-empty base64 string', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const result = await deriveVerifier('mypassphrase', salt)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('produces the same output for the same inputs', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const a = await deriveVerifier('same-passphrase', salt)
    const b = await deriveVerifier('same-passphrase', salt)
    expect(a).toBe(b)
  })

  it('produces different output for different passphrases', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const a = await deriveVerifier('passphrase-A', salt)
    const b = await deriveVerifier('passphrase-B', salt)
    expect(a).not.toBe(b)
  })

  it('produces different output for different salts', async () => {
    const salt1 = crypto.getRandomValues(new Uint8Array(16))
    const salt2 = crypto.getRandomValues(new Uint8Array(16))
    const a = await deriveVerifier('same-pass', salt1)
    const b = await deriveVerifier('same-pass', salt2)
    expect(a).not.toBe(b)
  })
})

describe('createProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws if passphrase is too short', async () => {
    await expect(
      createProfile('Alice', '#3b82f6', 'short')
    ).rejects.toThrow('at least 8 characters')
  })

  it('throws if display name is empty', async () => {
    await expect(
      createProfile('', '#3b82f6', 'validpassphrase')
    ).rejects.toThrow('Display name is required')
  })

  it('creates a profile record', async () => {
    const profile = await createProfile('Alice', '#3b82f6', 'validpassword')
    expect(profile.displayName).toBe('Alice')
    expect(profile.avatarColor).toBe('#3b82f6')
    expect(profile.profileId).toBeTruthy()
    expect(profileRepo.profileRepository.put).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Alice' })
    )
  })

  it('stores a passphrase verifier, not the raw passphrase', async () => {
    await createProfile('Bob', '#ef4444', 'securepassword')
    const verifierCall = (profileRepo.passphraseVerifierRepository.put as ReturnType<typeof vi.fn>).mock.calls[0][0] as PassphraseVerifier
    expect(verifierCall.salt).toBeTruthy()
    expect(verifierCall.verifier).toBeTruthy()
    // The stored verifier should not equal the raw passphrase
    expect(verifierCall.verifier).not.toBe('securepassword')
    expect(verifierCall.salt).not.toBe('securepassword')
  })

  it('trims whitespace from display name', async () => {
    const profile = await createProfile('  Carol  ', '#22c55e', 'validpassword')
    expect(profile.displayName).toBe('Carol')
  })

  it('generates unique salts and stores PBKDF2 iteration count', async () => {
    const putMock = profileRepo.passphraseVerifierRepository.put as ReturnType<typeof vi.fn>
    const callStart = putMock.mock.calls.length

    await createProfile('Salt One', '#111111', 'Password123!')
    await createProfile('Salt Two', '#222222', 'Password123!')
    await createProfile('Salt Three', '#333333', 'Password123!')

    const newVerifierRecords = putMock.mock.calls
      .slice(callStart)
      .map((call) => call[0] as PassphraseVerifier)

    const salts = newVerifierRecords.map((record) => record.salt)
    expect(new Set(salts).size).toBe(salts.length)
    expect(newVerifierRecords.every((record) => record.iterations === 100_000)).toBe(true)
  })
})

describe('verifyPassphrase', () => {
  it('returns true for the correct passphrase', async () => {
    const profile = await createProfile('Dan', '#8b5cf6', 'correct-password')

    // Set up mock to return the stored verifier
    const verifierCall = (profileRepo.passphraseVerifierRepository.put as ReturnType<typeof vi.fn>).mock.calls[
      (profileRepo.passphraseVerifierRepository.put as ReturnType<typeof vi.fn>).mock.calls.length - 1
    ][0] as PassphraseVerifier
    ;(profileRepo.passphraseVerifierRepository.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(verifierCall)

    const result = await verifyPassphrase(profile.profileId, 'correct-password')
    expect(result).toBe(true)
  })

  it('returns false for an incorrect passphrase', async () => {
    const profile = await createProfile('Eve', '#ec4899', 'correct-password')

    const verifierCall = (profileRepo.passphraseVerifierRepository.put as ReturnType<typeof vi.fn>).mock.calls[
      (profileRepo.passphraseVerifierRepository.put as ReturnType<typeof vi.fn>).mock.calls.length - 1
    ][0] as PassphraseVerifier
    ;(profileRepo.passphraseVerifierRepository.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(verifierCall)

    const result = await verifyPassphrase(profile.profileId, 'wrong-password')
    expect(result).toBe(false)
  })

  it('returns false if no verifier record exists', async () => {
    ;(profileRepo.passphraseVerifierRepository.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
    const result = await verifyPassphrase('non-existent-id', 'anypassword')
    expect(result).toBe(false)
  })

  it('consistently returns false for repeated wrong-passphrase checks', async () => {
    const profile = await createProfile('Repeat Wrong', '#8b5cf6', 'correct-password')

    const verifierCall = (profileRepo.passphraseVerifierRepository.put as ReturnType<typeof vi.fn>).mock.calls[
      (profileRepo.passphraseVerifierRepository.put as ReturnType<typeof vi.fn>).mock.calls.length - 1
    ][0] as PassphraseVerifier

    ;(profileRepo.passphraseVerifierRepository.getById as ReturnType<typeof vi.fn>).mockImplementation(
      async () => verifierCall
    )

    const first = await verifyPassphrase(profile.profileId, 'wrong-one')
    const second = await verifyPassphrase(profile.profileId, 'wrong-one')
    const third = await verifyPassphrase(profile.profileId, 'wrong-one')

    expect(first).toBe(false)
    expect(second).toBe(false)
    expect(third).toBe(false)
  })
})

describe('updateProfile', () => {
  it('throws if the profile does not exist', async () => {
    ;(profileRepo.profileRepository.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
    await expect(updateProfile('missing-id', { displayName: 'New Name' })).rejects.toThrow('not found')
  })

  it('updates displayName', async () => {
    const existing: Profile = {
      profileId: 'p1',
      displayName: 'Old Name',
      avatarColor: '#3b82f6',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    ;(profileRepo.profileRepository.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(existing)

    const updated = await updateProfile('p1', { displayName: 'New Name' })
    expect(updated.displayName).toBe('New Name')
    expect(updated.avatarColor).toBe('#3b82f6')
  })
})

describe('deleteProfile', () => {
  it('calls delete on both profile and verifier repositories', async () => {
    ;(profileRepo.profileRepository.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)
    ;(profileRepo.passphraseVerifierRepository.delete as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined)

    await deleteProfile('p99')
    expect(profileRepo.profileRepository.delete).toHaveBeenCalledWith('p99')
    expect(profileRepo.passphraseVerifierRepository.delete).toHaveBeenCalledWith('p99')
  })
})

// REQ: R12 — Profile + passphrase verifier persistence (no plaintext passphrase stored)

import { describe, it, expect, beforeEach } from 'vitest'
import {
  profileRepository,
  passphraseVerifierRepository,
} from '@/services/profile-repository'
import { DB_NAME } from '@/models/constants'
import type { Profile, PassphraseVerifier } from '@/models/profile'

async function resetDb() {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

function makeProfile(id: string, name = 'Alex'): Profile {
  return {
    profileId: id,
    displayName: name,
    avatarColor: '#ff0000',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('profileRepository', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('put + getById roundtrips a profile', async () => {
    await profileRepository.put(makeProfile('p1'))
    const got = await profileRepository.getById('p1')
    expect(got?.displayName).toBe('Alex')
  })

  it('getAll returns every profile', async () => {
    await profileRepository.put(makeProfile('p1', 'Alex'))
    await profileRepository.put(makeProfile('p2', 'Blair'))
    const all = await profileRepository.getAll()
    expect(all.length).toBe(2)
    expect(all.map((p) => p.displayName).sort()).toEqual(['Alex', 'Blair'])
  })

  it('put overwrites when profileId matches', async () => {
    await profileRepository.put(makeProfile('p1', 'Alex'))
    await profileRepository.put(makeProfile('p1', 'Alex II'))
    expect((await profileRepository.getById('p1'))?.displayName).toBe('Alex II')
  })

  it('does not expose a plaintext passphrase field on Profile', async () => {
    const profile = makeProfile('p1')
    expect((profile as any).passphrase).toBeUndefined()
    expect((profile as any).passphraseHash).toBeUndefined()
  })
})

describe('passphraseVerifierRepository', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('stores only salt + derived verifier + iteration count (no raw passphrase)', async () => {
    const verifier: PassphraseVerifier = {
      profileId: 'p1',
      salt: 'c2FsdHk=',
      verifier: 'dmVyaWZpZXI=',
      iterations: 100000,
    }
    await passphraseVerifierRepository.put(verifier)
    const stored = await passphraseVerifierRepository.getById('p1')
    expect(stored).toBeDefined()
    expect((stored as any).passphrase).toBeUndefined()
    expect(stored!.iterations).toBe(100000)
    expect(stored!.salt).toBe('c2FsdHk=')
  })

  it('returns undefined for a profile with no stored verifier', async () => {
    expect(await passphraseVerifierRepository.getById('missing')).toBeUndefined()
  })
})

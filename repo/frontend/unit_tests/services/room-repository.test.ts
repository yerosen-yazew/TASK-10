// REQ: R1 — Room metadata persistence

import { describe, it, expect, beforeEach } from 'vitest'
import { roomRepository } from '@/services/room-repository'
import { DB_NAME } from '@/models/constants'
import type { Room } from '@/models/room'

async function resetDb() {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

function makeRoom(id: string, name = id, createdAt = '2026-01-01T00:00:00.000Z'): Room {
  return {
    roomId: id,
    name,
    description: '',
    hostProfileId: 'host-1',
    pairingCode: 'AAAA-BBBB',
    settings: { requireApproval: false, enableSecondReviewer: false },
    createdAt,
    updatedAt: createdAt,
  }
}

describe('roomRepository', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('put + getById roundtrips a room', async () => {
    await roomRepository.put(makeRoom('r1'))
    expect((await roomRepository.getById('r1'))?.name).toBe('r1')
  })

  it('listAll returns every room', async () => {
    await roomRepository.put(makeRoom('r1'))
    await roomRepository.put(makeRoom('r2'))
    const all = await roomRepository.listAll()
    expect(all.map((r) => r.roomId).sort()).toEqual(['r1', 'r2'])
  })

  it('put persists updatedAt on subsequent writes', async () => {
    await roomRepository.put(makeRoom('r1'))
    const later = { ...makeRoom('r1'), updatedAt: '2026-06-01T00:00:00.000Z' }
    await roomRepository.put(later)
    expect((await roomRepository.getById('r1'))?.updatedAt).toBe(
      '2026-06-01T00:00:00.000Z',
    )
  })

  it('delete removes a room', async () => {
    await roomRepository.put(makeRoom('r1'))
    await roomRepository.delete('r1')
    expect(await roomRepository.getById('r1')).toBeUndefined()
  })

  it('getById returns undefined for unknown roomIds', async () => {
    expect(await roomRepository.getById('ghost')).toBeUndefined()
  })
})

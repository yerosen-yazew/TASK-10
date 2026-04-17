// REQ: R8 — 3 pinned messages max per room

import { describe, it, expect, beforeEach } from 'vitest'
import { pinnedMessageRepository } from '@/services/pinned-message-repository'
import { DB_NAME, MAX_PINNED_MESSAGES } from '@/models/constants'
import type { PinnedMessage } from '@/models/chat'

async function resetDb() {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

function makePin(roomId: string, messageId: string): PinnedMessage {
  return {
    roomId,
    messageId,
    pinnedBy: 'host-1',
    pinnedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('pinnedMessageRepository', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('put + find retrieves a pin by composite key', async () => {
    await pinnedMessageRepository.put(makePin('r1', 'm1'))
    expect((await pinnedMessageRepository.find('r1', 'm1'))?.pinnedBy).toBe('host-1')
  })

  it('listByRoom returns every pin for a room', async () => {
    await pinnedMessageRepository.put(makePin('r1', 'a'))
    await pinnedMessageRepository.put(makePin('r1', 'b'))
    await pinnedMessageRepository.put(makePin('r2', 'c'))
    const pins = await pinnedMessageRepository.listByRoom('r1')
    expect(pins.map((p) => p.messageId).sort()).toEqual(['a', 'b'])
  })

  it('countByRoom is used for the MAX_PINNED_MESSAGES cap', async () => {
    for (let i = 0; i < 2; i++) {
      await pinnedMessageRepository.put(makePin('r1', `m${i}`))
    }
    const count = await pinnedMessageRepository.countByRoom('r1')
    expect(count).toBe(2)
    expect(count).toBeLessThanOrEqual(MAX_PINNED_MESSAGES)
  })

  it('find returns undefined when no pin exists for the message', async () => {
    expect(await pinnedMessageRepository.find('r1', 'missing')).toBeUndefined()
  })

  it('delete removes a pin', async () => {
    await pinnedMessageRepository.put(makePin('r1', 'm1'))
    await pinnedMessageRepository.delete(['r1', 'm1'])
    expect(await pinnedMessageRepository.find('r1', 'm1')).toBeUndefined()
  })
})

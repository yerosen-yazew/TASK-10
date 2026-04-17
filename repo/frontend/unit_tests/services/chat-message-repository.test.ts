// REQ: R8 — deleteOldestExcess trims most-recent N messages when above the cap

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chatMessageRepository } from '@/services/chat-message-repository'
import type { ChatMessage } from '@/models/chat'

function makeMessage(id: string, roomId: string, createdAt: string): ChatMessage {
  return {
    messageId: id,
    roomId,
    authorId: 'u-1',
    authorDisplayName: 'Alice',
    text: id,
    mentions: [],
    createdAt,
    isDeleted: false,
  }
}

let store: Map<string, ChatMessage>

beforeEach(() => {
  vi.restoreAllMocks()
  store = new Map()
  vi.spyOn(
    chatMessageRepository as unknown as { query: typeof chatMessageRepository['query'] },
    'query'
  ).mockImplementation(async (_indexName: string, value: IDBValidKey) => {
    return Array.from(store.values()).filter((m) => m.roomId === value)
  })
  vi.spyOn(
    chatMessageRepository as unknown as { delete: typeof chatMessageRepository['delete'] },
    'delete'
  ).mockImplementation(async (key: string) => {
    store.delete(key)
  })
  vi.spyOn(
    chatMessageRepository as unknown as { count: typeof chatMessageRepository['count'] },
    'count'
  ).mockImplementation(async (_indexName?: string, value?: IDBValidKey) => {
    return Array.from(store.values()).filter((m) => m.roomId === value).length
  })
})

describe('chatMessageRepository.listByRoom', () => {
  it('returns messages ascending by createdAt', async () => {
    store.set('a', makeMessage('a', 'room-1', '2026-01-01T00:00:03Z'))
    store.set('b', makeMessage('b', 'room-1', '2026-01-01T00:00:01Z'))
    store.set('c', makeMessage('c', 'room-1', '2026-01-01T00:00:02Z'))
    const list = await chatMessageRepository.listByRoom('room-1')
    expect(list.map((m) => m.messageId)).toEqual(['b', 'c', 'a'])
  })
})

describe('chatMessageRepository.deleteOldestExcess', () => {
  it('removes the oldest messages above the cap', async () => {
    for (let i = 0; i < 10; i++) {
      const ts = new Date(Date.parse('2026-01-01T00:00:00Z') + i * 1000).toISOString()
      store.set(`m-${i}`, makeMessage(`m-${i}`, 'room-1', ts))
    }
    const removed = await chatMessageRepository.deleteOldestExcess('room-1', 6)
    expect(removed).toBe(4)
    expect(store.size).toBe(6)
    for (let i = 0; i < 4; i++) {
      expect(store.has(`m-${i}`)).toBe(false)
    }
    for (let i = 4; i < 10; i++) {
      expect(store.has(`m-${i}`)).toBe(true)
    }
  })

  it('returns 0 and removes nothing when below the cap', async () => {
    store.set('x', makeMessage('x', 'room-1', '2026-01-01T00:00:00Z'))
    const removed = await chatMessageRepository.deleteOldestExcess('room-1', 5)
    expect(removed).toBe(0)
    expect(store.size).toBe(1)
  })

  it('does not touch messages from other rooms', async () => {
    for (let i = 0; i < 5; i++) {
      const ts = new Date(Date.parse('2026-01-01T00:00:00Z') + i * 1000).toISOString()
      store.set(`a-${i}`, makeMessage(`a-${i}`, 'room-1', ts))
    }
    store.set('other', makeMessage('other', 'room-2', '2026-01-01T00:00:00Z'))
    await chatMessageRepository.deleteOldestExcess('room-1', 2)
    expect(store.has('other')).toBe(true)
    expect(Array.from(store.values()).filter((m) => m.roomId === 'room-1').length).toBe(2)
  })

  it('returns 0 when exactly at the cap (boundary)', async () => {
    for (let i = 0; i < 3; i++) {
      store.set(`m-${i}`, makeMessage(`m-${i}`, 'room-1', `2026-01-01T00:00:0${i}Z`))
    }
    const removed = await chatMessageRepository.deleteOldestExcess('room-1', 3)
    expect(removed).toBe(0)
    expect(store.size).toBe(3)
  })
})

describe('chatMessageRepository.countByRoom', () => {
  it('returns 0 for a room with no messages', async () => {
    expect(await chatMessageRepository.countByRoom('empty-room')).toBe(0)
  })

  it('returns the room-scoped count', async () => {
    store.set('a', makeMessage('a', 'room-1', '2026-01-01T00:00:01Z'))
    store.set('b', makeMessage('b', 'room-1', '2026-01-01T00:00:02Z'))
    store.set('c', makeMessage('c', 'room-2', '2026-01-01T00:00:03Z'))
    expect(await chatMessageRepository.countByRoom('room-1')).toBe(2)
    expect(await chatMessageRepository.countByRoom('room-2')).toBe(1)
  })
})

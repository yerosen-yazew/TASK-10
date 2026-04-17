// REQ: R8 — 5,000 message retention and 3-pin cap
// REQ: R10 — Pin/unpin activity emission

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  sendMessage,
  listRecent,
  pinMessage,
  unpinMessage,
  listPinned,
  applyChatMutation,
} from '@/engine/chat-engine'
import type { ChatMessage, PinnedMessage } from '@/models/chat'
import type { ActivityEvent } from '@/models/activity'
import { ActivityEventType } from '@/models/activity'
import { MAX_CHAT_MESSAGES_RETAINED } from '@/models/constants'

const chatStore = new Map<string, ChatMessage>()
const pinStore = new Map<string, PinnedMessage>()
const activityStore: ActivityEvent[] = []

const pinKey = (roomId: string, messageId: string) => `${roomId}::${messageId}`

vi.mock('@/services/chat-message-repository', () => ({
  chatMessageRepository: {
    put: vi.fn(async (m: ChatMessage) => {
      chatStore.set(m.messageId, m)
    }),
    listByRoom: vi.fn(async (roomId: string) =>
      Array.from(chatStore.values())
        .filter((m) => m.roomId === roomId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    ),
    countByRoom: vi.fn(async (roomId: string) =>
      Array.from(chatStore.values()).filter((m) => m.roomId === roomId).length
    ),
    getById: vi.fn(async (id: string) => chatStore.get(id)),
    deleteOldestExcess: vi.fn(async (roomId: string, cap: number) => {
      const all = Array.from(chatStore.values())
        .filter((m) => m.roomId === roomId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      const excess = all.length - cap
      for (let i = 0; i < excess; i++) {
        chatStore.delete(all[i].messageId)
      }
    }),
  },
}))

vi.mock('@/services/pinned-message-repository', () => ({
  pinnedMessageRepository: {
    put: vi.fn(async (p: PinnedMessage) => {
      pinStore.set(pinKey(p.roomId, p.messageId), p)
    }),
    find: vi.fn(async (roomId: string, messageId: string) =>
      pinStore.get(pinKey(roomId, messageId))
    ),
    delete: vi.fn(async (key: [string, string]) => {
      pinStore.delete(pinKey(key[0], key[1]))
    }),
    listByRoom: vi.fn(async (roomId: string) =>
      Array.from(pinStore.values()).filter((p) => p.roomId === roomId)
    ),
    countByRoom: vi.fn(async (roomId: string) =>
      Array.from(pinStore.values()).filter((p) => p.roomId === roomId).length
    ),
  },
}))

vi.mock('@/services/activity-repository', () => ({
  activityRepository: {
    put: vi.fn(async (e: ActivityEvent) => {
      activityStore.push(e)
    }),
  },
}))

const actor = { memberId: 'u-1', displayName: 'User 1' }

beforeEach(() => {
  chatStore.clear()
  pinStore.clear()
  activityStore.length = 0
})

describe('sendMessage', () => {
  it('persists a message and returns it', async () => {
    const result = await sendMessage({
      roomId: 'room-1',
      authorId: 'u-1',
      authorDisplayName: 'Alice',
      text: 'hello',
    })
    expect(result.validation.valid).toBe(true)
    expect(result.message?.text).toBe('hello')
    const list = await listRecent('room-1')
    expect(list).toHaveLength(1)
  })

  it('trims the oldest message when the 5,001st arrives', async () => {
    // Seed MAX_CHAT_MESSAGES_RETAINED messages with strictly-increasing createdAt.
    const base = Date.parse('2026-01-01T00:00:00.000Z')
    for (let i = 0; i < MAX_CHAT_MESSAGES_RETAINED; i++) {
      chatStore.set(`m-${i}`, {
        messageId: `m-${i}`,
        roomId: 'room-1',
        authorId: 'u-1',
        authorDisplayName: 'Alice',
        text: `#${i}`,
        mentions: [],
        createdAt: new Date(base + i).toISOString(),
        isDeleted: false,
      })
    }
    await sendMessage({
      roomId: 'room-1',
      authorId: 'u-1',
      authorDisplayName: 'Alice',
      text: 'newest',
    })
    expect(chatStore.size).toBe(MAX_CHAT_MESSAGES_RETAINED)
    expect(chatStore.has('m-0')).toBe(false)
  })
})

describe('pinMessage / unpinMessage', () => {
  it('pins a message and emits MessagePinned', async () => {
    const result = await pinMessage('room-1', 'msg-1', actor)
    expect(result.validation.valid).toBe(true)
    expect(pinStore.size).toBe(1)
    expect(activityStore.some((e) => e.type === ActivityEventType.MessagePinned)).toBe(true)
  })

  it('rejects pinning the same message twice', async () => {
    await pinMessage('room-1', 'msg-1', actor)
    const dup = await pinMessage('room-1', 'msg-1', actor)
    expect(dup.validation.valid).toBe(false)
    expect(dup.validation.errors[0].code).toBe('duplicate')
  })

  it('rejects the 4th pin in a room', async () => {
    await pinMessage('room-1', 'msg-1', actor)
    await pinMessage('room-1', 'msg-2', actor)
    await pinMessage('room-1', 'msg-3', actor)
    const fourth = await pinMessage('room-1', 'msg-4', actor)
    expect(fourth.validation.valid).toBe(false)
    expect(fourth.validation.errors[0].code).toBe('max_count')
  })

  it('unpins an existing pin and emits MessageUnpinned', async () => {
    await pinMessage('room-1', 'msg-1', actor)
    activityStore.length = 0
    const result = await unpinMessage('room-1', 'msg-1', actor)
    expect(result.valid).toBe(true)
    const pinned = await listPinned('room-1')
    expect(pinned).toHaveLength(0)
    expect(activityStore.some((e) => e.type === ActivityEventType.MessageUnpinned)).toBe(true)
  })

  it('returns not_found when unpinning a message that is not pinned', async () => {
    const result = await unpinMessage('room-1', 'never-pinned', actor)
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('not_found')
  })
})

describe('applyChatMutation', () => {
  it('applies remote new-message payload and keeps retention bounds', async () => {
    const result = await applyChatMutation('room-1', {
      operation: 'new',
      messageId: 'remote-1',
      message: {
        messageId: 'remote-1',
        roomId: 'room-1',
        authorId: 'peer-1',
        authorDisplayName: 'Peer',
        text: 'hello from peer',
        mentions: [],
        createdAt: new Date().toISOString(),
        isDeleted: false,
      },
    })
    expect(result.valid).toBe(true)
    expect(chatStore.has('remote-1')).toBe(true)
  })

  it('applies remote pin/unpin payloads', async () => {
    const pin = await applyChatMutation('room-1', {
      operation: 'pin',
      messageId: 'remote-1',
      pinned: {
        roomId: 'room-1',
        messageId: 'remote-1',
        pinnedBy: 'peer-1',
        pinnedAt: new Date().toISOString(),
      },
    })
    expect(pin.valid).toBe(true)
    expect(pinStore.has('room-1::remote-1')).toBe(true)

    const unpin = await applyChatMutation('room-1', {
      operation: 'unpin',
      messageId: 'remote-1',
    })
    expect(unpin.valid).toBe(true)
    expect(pinStore.has('room-1::remote-1')).toBe(false)
  })
})

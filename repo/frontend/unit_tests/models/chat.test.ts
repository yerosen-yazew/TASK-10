// REQ: chat model contract fixtures

import { describe, expect, it } from 'vitest'
import type { ChatMessage, PinnedMessage } from '@/models/chat'

describe('chat model', () => {
  it('accepts chat message fixtures with mentions', () => {
    const message: ChatMessage = {
      messageId: 'msg-1',
      roomId: 'room-1',
      authorId: 'member-1',
      authorDisplayName: 'Alex',
      text: 'hello @sam',
      mentions: [{ memberId: 'member-2', displayName: 'Sam' }],
      createdAt: '2026-01-01T00:00:00.000Z',
      isDeleted: false,
    }

    expect(message.mentions).toHaveLength(1)
    expect(message.isDeleted).toBe(false)
  })

  it('accepts pinned message fixtures', () => {
    const pin: PinnedMessage = {
      roomId: 'room-1',
      messageId: 'msg-1',
      pinnedBy: 'host-1',
      pinnedAt: '2026-01-01T00:01:00.000Z',
    }

    expect(pin.messageId).toBe('msg-1')
    expect(pin.pinnedBy).toBe('host-1')
  })
})

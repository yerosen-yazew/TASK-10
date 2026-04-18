// REQ: presence model fixtures

import { describe, expect, it } from 'vitest'
import type { CursorPosition, AvatarInfo, PresenceState } from '@/models/presence'

describe('presence model', () => {
  it('accepts cursor and avatar fixtures', () => {
    const cursor: CursorPosition = {
      x: 140,
      y: 220,
      timestamp: 1700000000000,
    }

    const avatar: AvatarInfo = {
      memberId: 'member-1',
      displayName: 'Alex',
      avatarColor: '#2563eb',
      role: 'Host',
    }

    expect(cursor.x).toBe(140)
    expect(avatar.role).toBe('Host')
  })

  it('accepts a presence state fixture', () => {
    const state: PresenceState = {
      memberId: 'member-1',
      roomId: 'room-1',
      displayName: 'Alex',
      avatarColor: '#2563eb',
      isOnline: true,
      cursor: { x: 1, y: 2, timestamp: 1700000000000 },
      currentTool: 'sticky',
      lastSeenAt: '2026-01-01T00:00:00.000Z',
    }

    expect(state.isOnline).toBe(true)
    expect(state.currentTool).toBe('sticky')
  })
})

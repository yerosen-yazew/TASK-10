// REQ: R9 — Presence: avatar stack + cursor/name tags (ephemeral, in-memory only)

import { describe, it, expect, beforeEach } from 'vitest'
import {
  setPresence,
  updateCursor,
  setActive,
  setIdle,
  leavePresence,
  listPresent,
  subscribe,
  resetPresence,
} from '@/engine/presence-engine'
import type { PresenceState } from '@/models/presence'

function makePresence(
  memberId: string,
  roomId = 'room-1',
  displayName = `U-${memberId}`
): PresenceState {
  return {
    memberId,
    roomId,
    displayName,
    avatarColor: '#abc',
    isOnline: true,
    cursor: null,
    currentTool: null,
    lastSeenAt: new Date().toISOString(),
  }
}

beforeEach(() => {
  resetPresence()
})

describe('setPresence + listPresent', () => {
  it('registers a member and lists them under the right room only', () => {
    setPresence(makePresence('u-1', 'room-1'))
    setPresence(makePresence('u-2', 'room-2'))
    expect(listPresent('room-1')).toHaveLength(1)
    expect(listPresent('room-1')[0].memberId).toBe('u-1')
    expect(listPresent('room-2')).toHaveLength(1)
  })
})

describe('updateCursor', () => {
  it('stores a cursor position for an existing presence', () => {
    setPresence(makePresence('u-1'))
    updateCursor('room-1', 'u-1', { x: 5, y: 7, timestamp: 1 })
    const state = listPresent('room-1')[0]
    expect(state.cursor).toEqual({ x: 5, y: 7, timestamp: 1 })
  })

  it('ignores cursor updates for an unregistered member', () => {
    updateCursor('room-1', 'ghost', { x: 0, y: 0, timestamp: 0 })
    expect(listPresent('room-1')).toHaveLength(0)
  })
})

describe('setActive / setIdle', () => {
  it('clears the cursor when transitioning to idle', () => {
    setPresence(makePresence('u-1'))
    updateCursor('room-1', 'u-1', { x: 1, y: 1, timestamp: 1 })
    setIdle('room-1', 'u-1')
    expect(listPresent('room-1')[0].cursor).toBeNull()
    setActive('room-1', 'u-1')
    expect(listPresent('room-1')[0].isOnline).toBe(true)
  })
})

describe('leavePresence', () => {
  it('removes the member from the room', () => {
    setPresence(makePresence('u-1'))
    leavePresence('room-1', 'u-1')
    expect(listPresent('room-1')).toHaveLength(0)
  })
})

describe('subscribe', () => {
  it('fires the handler on changes and unsubscribes cleanly', () => {
    const calls: PresenceState[][] = []
    const unsubscribe = subscribe('room-1', (s) => calls.push(s))
    setPresence(makePresence('u-1'))
    setPresence(makePresence('u-2'))
    expect(calls.length).toBeGreaterThanOrEqual(2)
    const before = calls.length
    unsubscribe()
    setPresence(makePresence('u-3'))
    expect(calls.length).toBe(before)
  })
})

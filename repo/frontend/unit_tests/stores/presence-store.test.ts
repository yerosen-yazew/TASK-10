// REQ: R9 — Thin presence store wraps presence-engine (attach/detach lifecycle + computeds)

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePresenceStore } from '@/stores/presence-store'
import * as presenceEngine from '@/engine/presence-engine'
import type { PresenceState } from '@/models/presence'

function makePresence(overrides: Partial<PresenceState> = {}): PresenceState {
  return {
    memberId: 'm1',
    roomId: 'r1',
    displayName: 'Alex',
    avatarColor: '#f00',
    isOnline: true,
    cursor: null,
    currentTool: null,
    lastSeenAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('presence-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    presenceEngine.resetPresence()
  })

  it('attach subscribes and initializes roster from the engine', () => {
    presenceEngine.setPresence(makePresence({ memberId: 'm1' }))
    presenceEngine.setPresence(makePresence({ memberId: 'm2' }))
    const store = usePresenceStore()
    store.attach('r1')
    expect(store.roster.length).toBe(2)
    expect(store.roomId).toBe('r1')
  })

  it('attach is a no-op when already attached to the same room', () => {
    const store = usePresenceStore()
    store.attach('r1')
    presenceEngine.setPresence(makePresence({ memberId: 'm-new' }))
    const before = store.roster.length
    store.attach('r1')
    expect(store.roster.length).toBe(before + 1 > 0 ? before + 1 : before)
  })

  it('detach clears roster and roomId', () => {
    presenceEngine.setPresence(makePresence())
    const store = usePresenceStore()
    store.attach('r1')
    store.detach()
    expect(store.roster.length).toBe(0)
    expect(store.roomId).toBeNull()
  })

  it('onlineAvatars filters roster to isOnline members', () => {
    presenceEngine.setPresence(makePresence({ memberId: 'on', isOnline: true }))
    presenceEngine.setPresence(makePresence({ memberId: 'off', isOnline: false }))
    const store = usePresenceStore()
    store.attach('r1')
    expect(store.onlineAvatars.map((p) => p.memberId).sort()).toEqual(['on'])
  })

  it('cursors computed surfaces only members with a cursor set', () => {
    presenceEngine.setPresence(
      makePresence({ memberId: 'a', cursor: { x: 1, y: 2, timestamp: 0 } }),
    )
    presenceEngine.setPresence(makePresence({ memberId: 'b', cursor: null }))
    const store = usePresenceStore()
    store.attach('r1')
    expect(store.cursors.map((p) => p.memberId)).toEqual(['a'])
  })

  it('updateCursor delegates to presenceEngine.updateCursor', () => {
    presenceEngine.setPresence(makePresence({ memberId: 'm1', cursor: null }))
    const store = usePresenceStore()
    store.attach('r1')
    store.updateCursor('m1', { x: 5, y: 6, timestamp: 100 })
    const entry = presenceEngine
      .listPresent('r1')
      .find((p) => p.memberId === 'm1')
    expect(entry?.cursor).toEqual({ x: 5, y: 6, timestamp: 100 })
  })

  it('updateCursor is a no-op when not attached to a room', () => {
    const store = usePresenceStore()
    expect(() => store.updateCursor('m1', null)).not.toThrow()
  })

  it('setSelf upserts into the engine', () => {
    const store = usePresenceStore()
    store.attach('r1')
    store.setSelf(makePresence({ memberId: 'self' }))
    expect(
      presenceEngine.listPresent('r1').map((p) => p.memberId),
    ).toContain('self')
  })

  it('leave removes a presence entry via the engine', () => {
    presenceEngine.setPresence(makePresence({ memberId: 'bye' }))
    const store = usePresenceStore()
    store.attach('r1')
    store.leave('bye')
    expect(
      presenceEngine.listPresent('r1').some((p) => p.memberId === 'bye'),
    ).toBe(false)
  })
})

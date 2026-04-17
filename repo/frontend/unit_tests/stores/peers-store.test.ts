// REQ: R19 — Peers store: peer management, pairing step transitions

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePeersStore } from '@/stores/peers-store'

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

const makePeer = (id: string, state: string = 'new') => ({
  peerId: id,
  displayName: `Peer ${id}`,
  roomId: 'room-1',
  connectionState: state,
  connectedAt: '2026-01-01T00:00:00.000Z',
})

describe('peers-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('addPeer', () => {
    it('adds a new peer to the list', () => {
      const store = usePeersStore()
      store.addPeer(makePeer('p1'))
      expect(store.peers).toHaveLength(1)
      expect(store.peers[0].peerId).toBe('p1')
    })

    it('replaces existing peer with same peerId', () => {
      const store = usePeersStore()
      store.addPeer(makePeer('p1', 'new'))
      store.addPeer(makePeer('p1', 'connected'))
      expect(store.peers).toHaveLength(1)
      expect(store.peers[0].connectionState).toBe('connected')
    })
  })

  describe('removePeer', () => {
    it('removes peer by peerId', () => {
      const store = usePeersStore()
      store.addPeer(makePeer('p1'))
      store.addPeer(makePeer('p2'))
      store.removePeer('p1')
      expect(store.peers).toHaveLength(1)
      expect(store.peers[0].peerId).toBe('p2')
    })

    it('is a no-op for unknown peerId', () => {
      const store = usePeersStore()
      store.addPeer(makePeer('p1'))
      store.removePeer('unknown')
      expect(store.peers).toHaveLength(1)
    })
  })

  describe('updatePeer', () => {
    it('merges patch into existing peer', () => {
      const store = usePeersStore()
      store.addPeer(makePeer('p1', 'new'))
      store.updatePeer('p1', { connectionState: 'connected' })
      expect(store.peers[0].connectionState).toBe('connected')
    })

    it('is a no-op for unknown peerId', () => {
      const store = usePeersStore()
      store.addPeer(makePeer('p1'))
      store.updatePeer('unknown', { connectionState: 'connected' })
      expect(store.peers[0].connectionState).toBe('new')
    })
  })

  describe('pairing step transitions', () => {
    it('starts at idle', () => {
      const store = usePeersStore()
      expect(store.pairingStep).toBe('idle')
    })

    it('transitions through full pairing sequence', () => {
      const store = usePeersStore()
      store.setPairingStep('generating')
      expect(store.pairingStep).toBe('generating')
      store.setPairingStep('awaiting-answer')
      expect(store.pairingStep).toBe('awaiting-answer')
      store.setPairingStep('connecting')
      expect(store.pairingStep).toBe('connecting')
      store.setPairingStep('connected')
      expect(store.pairingStep).toBe('connected')
    })

    it('transitions to failed on error', () => {
      const store = usePeersStore()
      store.setPairingStep('connecting')
      store.setPairingStep('failed')
      expect(store.pairingStep).toBe('failed')
    })

    it('resetPairing clears all pairing state', () => {
      const store = usePeersStore()
      store.setPairingStep('failed')
      store.setLocalOffer('offer-data')
      store.setLocalAnswer('answer-data')
      store.setPairingError('Connection failed')
      store.resetPairing()
      expect(store.pairingStep).toBe('idle')
      expect(store.localOffer).toBeNull()
      expect(store.localAnswer).toBeNull()
      expect(store.pairingError).toBeNull()
    })
  })

  describe('connectedPeers computed', () => {
    it('returns only peers with connected state', () => {
      const store = usePeersStore()
      store.addPeer(makePeer('p1', 'connected'))
      store.addPeer(makePeer('p2', 'new'))
      store.addPeer(makePeer('p3', 'connected'))
      expect(store.connectedPeers).toHaveLength(2)
    })
  })
})

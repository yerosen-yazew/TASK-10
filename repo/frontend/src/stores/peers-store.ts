// REQ: R19 — WebRTC peer state for manual pairing flow

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PeerDescriptor } from '@/models/collaboration'
import { logger } from '@/utils/logger'

export type PairingStep =
  | 'idle'
  | 'generating'
  | 'awaiting-answer'
  | 'connecting'
  | 'connected'
  | 'failed'

export const usePeersStore = defineStore('peers', () => {
  const peers = ref<PeerDescriptor[]>([])
  const pairingStep = ref<PairingStep>('idle')
  const localOffer = ref<string | null>(null)
  const localAnswer = ref<string | null>(null)
  const pairingError = ref<string | null>(null)

  const connectedPeers = computed(() =>
    peers.value.filter((p) => p.connectionState === 'connected')
  )

  function addPeer(peer: PeerDescriptor): void {
    const idx = peers.value.findIndex((p) => p.peerId === peer.peerId)
    if (idx !== -1) {
      peers.value.splice(idx, 1, peer)
    } else {
      peers.value.push(peer)
    }
    logger.info('Peer added', { peerId: peer.peerId })
  }

  function removePeer(peerId: string): void {
    peers.value = peers.value.filter((p) => p.peerId !== peerId)
    logger.info('Peer removed', { peerId })
  }

  function updatePeer(peerId: string, patch: Partial<PeerDescriptor>): void {
    const idx = peers.value.findIndex((p) => p.peerId === peerId)
    if (idx !== -1) {
      peers.value.splice(idx, 1, { ...peers.value[idx], ...patch })
    }
  }

  function setPairingStep(step: PairingStep): void {
    pairingStep.value = step
  }

  function setLocalOffer(offer: string | null): void {
    localOffer.value = offer
  }

  function setLocalAnswer(answer: string | null): void {
    localAnswer.value = answer
  }

  function setPairingError(err: string | null): void {
    pairingError.value = err
  }

  function resetPairing(): void {
    pairingStep.value = 'idle'
    localOffer.value = null
    localAnswer.value = null
    pairingError.value = null
  }

  return {
    peers,
    pairingStep,
    localOffer,
    localAnswer,
    pairingError,
    connectedPeers,
    addPeer,
    removePeer,
    updatePeer,
    setPairingStep,
    setLocalOffer,
    setLocalAnswer,
    setPairingError,
    resetPairing,
  }
})

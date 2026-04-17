// REQ: Test environment setup for Vitest + jsdom
// Polyfills: IndexedDB, BroadcastChannel, RTCPeerConnection, Web Crypto subtle

import 'fake-indexeddb/auto'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, vi } from 'vitest'

// --- BroadcastChannel stub --------------------------------------------------
// jsdom lacks BroadcastChannel. Fan out messages to all instances that share
// the same channel name within the same process.
type BCListener = (evt: { data: unknown }) => void
const bcRegistry = new Map<string, Set<BroadcastChannelStub>>()

class BroadcastChannelStub {
  readonly name: string
  onmessage: BCListener | null = null
  private listeners = new Set<BCListener>()
  private closed = false

  constructor(name: string) {
    this.name = name
    let peers = bcRegistry.get(name)
    if (!peers) {
      peers = new Set()
      bcRegistry.set(name, peers)
    }
    peers.add(this)
  }

  postMessage(data: unknown): void {
    if (this.closed) return
    const peers = bcRegistry.get(this.name)
    if (!peers) return
    for (const peer of peers) {
      if (peer === this || peer.closed) continue
      const evt = { data }
      peer.listeners.forEach((l) => l(evt))
      if (peer.onmessage) peer.onmessage(evt)
    }
  }

  addEventListener(type: string, listener: BCListener): void {
    if (type !== 'message') return
    this.listeners.add(listener)
  }

  removeEventListener(type: string, listener: BCListener): void {
    if (type !== 'message') return
    this.listeners.delete(listener)
  }

  close(): void {
    this.closed = true
    this.listeners.clear()
    const peers = bcRegistry.get(this.name)
    if (peers) {
      peers.delete(this)
      if (peers.size === 0) bcRegistry.delete(this.name)
    }
  }
}
;(globalThis as any).BroadcastChannel = BroadcastChannelStub

// --- RTCPeerConnection stub -------------------------------------------------
class RTCPeerConnectionStub {
  localDescription: { type: string; sdp: string } | null = null
  remoteDescription: { type: string; sdp: string } | null = null
  onicecandidate: ((e: { candidate: unknown }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  ondatachannel: ((e: { channel: unknown }) => void) | null = null
  connectionState = 'new'
  iceConnectionState = 'new'
  signalingState = 'stable'

  async createOffer() {
    return { type: 'offer', sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n' }
  }
  async createAnswer() {
    return { type: 'answer', sdp: 'v=0\r\no=- 2 2 IN IP4 127.0.0.1\r\n' }
  }
  async setLocalDescription(desc: { type: string; sdp: string }) {
    this.localDescription = desc
  }
  async setRemoteDescription(desc: { type: string; sdp: string }) {
    this.remoteDescription = desc
  }
  createDataChannel(label: string) {
    return {
      label,
      readyState: 'connecting',
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
  }
  async addIceCandidate(_c: unknown) {
    /* no-op */
  }
  close() {
    this.connectionState = 'closed'
  }
  addEventListener() {
    /* no-op */
  }
  removeEventListener() {
    /* no-op */
  }
}
;(globalThis as any).RTCPeerConnection = RTCPeerConnectionStub
;(globalThis as any).RTCSessionDescription = class {
  type: string
  sdp: string
  constructor(init: { type: string; sdp: string }) {
    this.type = init.type
    this.sdp = init.sdp
  }
}
;(globalThis as any).RTCIceCandidate = class {
  candidate: string
  constructor(init: { candidate?: string } = {}) {
    this.candidate = init.candidate ?? ''
  }
}

// --- Web Crypto --------------------------------------------------------------
// jsdom's crypto lacks a full subtle implementation for PBKDF2 testing.
if (!(globalThis.crypto && globalThis.crypto.subtle)) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  })
} else if (!(globalThis.crypto as any).subtle) {
  Object.defineProperty(globalThis.crypto, 'subtle', {
    value: (webcrypto as unknown as Crypto).subtle,
    configurable: true,
  })
}

// --- Global hooks -----------------------------------------------------------
afterEach(() => {
  vi.clearAllMocks()
})

beforeEach(() => {
  try {
    localStorage.clear()
  } catch {
    /* jsdom not ready yet */
  }
})

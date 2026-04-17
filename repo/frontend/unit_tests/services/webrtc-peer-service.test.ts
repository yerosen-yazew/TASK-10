// REQ: R19 — WebRTC peer service: createOffer, addRemoteOffer, closePeer, message routing

import { describe, it, expect, vi, beforeEach } from 'vitest'

// RTCPeerConnection is not available in jsdom — stub globally
class MockDataChannel {
  readyState = 'open'
  onmessage: ((e: MessageEvent) => void) | null = null
  send = vi.fn()
}

class MockRTCPeerConnection {
  connectionState = 'new'
  signalingState = 'stable'
  localDescription: RTCSessionDescription | null = null
  remoteDescription: RTCSessionDescription | null = null
  iceGatheringState = 'complete'
  onicecandidate: ((e: RTCPeerConnectionIceEvent) => void) | null = null
  onicegatheringstatechange: (() => void) | null = null

  _dc: MockDataChannel = new MockDataChannel()

  createDataChannel(_label: string): MockDataChannel {
    return this._dc
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'offer', sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' }
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: 'answer', sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' }
  }

  async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = desc as RTCSessionDescription
    // Simulate immediate ICE gathering complete
    this.iceGatheringState = 'complete'
    setTimeout(() => this.onicegatheringstatechange?.(), 0)
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = desc as RTCSessionDescription
  }

  close = vi.fn()
}

vi.stubGlobal('RTCPeerConnection', MockRTCPeerConnection)

vi.mock('@/models/constants', () => ({
  DATA_CHANNEL_LABEL: 'collab',
}))

vi.mock('@/serializers/pairing-codec', () => ({
  encodePairingPayload: vi.fn(async (payload: unknown) => JSON.stringify(payload)),
  decodePairingPayload: vi.fn(async (encoded: string) => JSON.parse(encoded)),
  verifyPairingChecksum: vi.fn(async () => true),
}))

vi.mock('@/utils/id-generator', () => ({
  generateId: vi.fn(() => 'gen-id'),
  generateVerificationCode: vi.fn(() => 'VER-CODE'),
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

describe('webrtc-peer-service', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Reset module state between tests
    const svc = await import('@/services/webrtc-peer-service')
    svc.closeAll()
  })

  describe('generatePeerId', () => {
    it('returns a non-empty string', async () => {
      const { generatePeerId } = await import('@/services/webrtc-peer-service')
      const id = generatePeerId()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })
  })

  describe('createOffer', () => {
    it('returns an encoded offer string', async () => {
      const { createOffer } = await import('@/services/webrtc-peer-service')
      const result = await createOffer('room-1', 'peer-1', 'Host')
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('registers the peer entry', async () => {
      const { createOffer, listPeers } = await import('@/services/webrtc-peer-service')
      await createOffer('room-1', 'peer-1', 'Host')
      expect(listPeers()).toHaveLength(1)
      expect(listPeers()[0].peerId).toBe('peer-1')
    })
  })

  describe('addRemoteOffer', () => {
    it('returns an encoded answer string', async () => {
      const { addRemoteOffer } = await import('@/services/webrtc-peer-service')
      const fakeOffer = JSON.stringify({
        version: 1,
        type: 'offer',
        roomId: 'room-1',
        peerId: 'remote-peer',
        displayName: 'Remote',
        timestamp: '2026-01-01T00:00:00.000Z',
        verificationCode: 'VER-CODE',
        sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n',
        iceCandidates: [],
      })
      const answer = await addRemoteOffer(fakeOffer, 'local-peer', 'Local')
      expect(typeof answer).toBe('string')
      expect(answer.length).toBeGreaterThan(0)
    })
  })

  describe('closePeer', () => {
    it('removes peer from registry', async () => {
      const { createOffer, closePeer, listPeers } = await import('@/services/webrtc-peer-service')
      await createOffer('room-1', 'peer-1', 'Host')
      expect(listPeers()).toHaveLength(1)
      closePeer('peer-1')
      expect(listPeers()).toHaveLength(0)
    })

    it('is a no-op for unknown peer', async () => {
      const { closePeer, listPeers } = await import('@/services/webrtc-peer-service')
      expect(() => closePeer('unknown')).not.toThrow()
      expect(listPeers()).toHaveLength(0)
    })
  })

  describe('closeAll', () => {
    it('removes all peers', async () => {
      const { createOffer, closeAll, listPeers } = await import('@/services/webrtc-peer-service')
      await createOffer('room-1', 'peer-1', 'Host')
      await createOffer('room-1', 'peer-2', 'Host2')
      closeAll()
      expect(listPeers()).toHaveLength(0)
    })
  })

  describe('onCollabMessage / sendCollabMessage', () => {
    it('onCollabMessage returns an unsubscribe function', async () => {
      const { onCollabMessage } = await import('@/services/webrtc-peer-service')
      const handler = vi.fn()
      const unsub = onCollabMessage(handler)
      expect(typeof unsub).toBe('function')
      unsub()
    })
  })
})

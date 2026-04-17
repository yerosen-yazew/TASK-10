// REQ: R19, R2 — Pairing codec encode/decode roundtrip and validation
import { describe, it, expect } from 'vitest'
import {
  encodePairingPayload,
  decodePairingPayload,
  verifyPairingChecksum,
  validatePairingPayload,
} from '@/serializers/pairing-codec'
import { PAIRING_PROTOCOL_VERSION } from '@/models/constants'

const sampleOffer = {
  version: PAIRING_PROTOCOL_VERSION as typeof PAIRING_PROTOCOL_VERSION,
  type: 'offer' as const,
  roomId: 'room-123',
  peerId: 'peer-abc',
  displayName: 'Alice',
  timestamp: '2026-01-01T00:00:00.000Z',
  verificationCode: 'FORGE-A1B2',
  sdp: 'v=0\r\no=- 1234 1 IN IP4 0.0.0.0\r\n...',
  iceCandidates: ['candidate:1 1 udp 2130706431 10.0.0.1 5000 typ host'],
}

describe('encodePairingPayload / decodePairingPayload', () => {
  it('roundtrips an offer payload', async () => {
    const encoded = await encodePairingPayload(sampleOffer)
    expect(typeof encoded).toBe('string')
    expect(encoded.length).toBeGreaterThan(0)

    const decoded = decodePairingPayload(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!.type).toBe('offer')
    expect(decoded!.roomId).toBe('room-123')
    expect(decoded!.peerId).toBe('peer-abc')
    expect(decoded!.checksum).toBeDefined()
  })

  it('roundtrips an answer payload', async () => {
    const answer = { ...sampleOffer, type: 'answer' as const }
    const encoded = await encodePairingPayload(answer)
    const decoded = decodePairingPayload(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded!.type).toBe('answer')
  })
})

describe('decodePairingPayload — invalid inputs', () => {
  it('returns null for garbage string', () => {
    expect(decodePairingPayload('not-valid-base64!!!')).toBeNull()
  })

  it('returns null for valid base64 but non-JSON', () => {
    expect(decodePairingPayload(btoa('not json'))).toBeNull()
  })

  it('returns null for JSON missing required fields', () => {
    const encoded = btoa(JSON.stringify({ foo: 'bar' }))
    expect(decodePairingPayload(encoded)).toBeNull()
  })

  it('returns null for wrong version', () => {
    const encoded = btoa(JSON.stringify({ ...sampleOffer, version: 99, checksum: 'abc' }))
    expect(decodePairingPayload(encoded)).toBeNull()
  })

  it('returns null for wrong type', () => {
    const encoded = btoa(JSON.stringify({ ...sampleOffer, type: 'unknown', checksum: 'abc' }))
    expect(decodePairingPayload(encoded)).toBeNull()
  })
})

describe('verifyPairingChecksum', () => {
  it('verifies a correctly encoded payload', async () => {
    const encoded = await encodePairingPayload(sampleOffer)
    const decoded = decodePairingPayload(encoded)!
    const valid = await verifyPairingChecksum(decoded)
    expect(valid).toBe(true)
  })

  it('rejects a payload with a tampered checksum', async () => {
    const encoded = await encodePairingPayload(sampleOffer)
    const decoded = decodePairingPayload(encoded)!
    decoded.checksum = 'tampered-checksum-value'
    const valid = await verifyPairingChecksum(decoded)
    expect(valid).toBe(false)
  })
})

describe('validatePairingPayload', () => {
  it('passes for a valid payload', () => {
    const payload = { ...sampleOffer, checksum: 'abc123' }
    const result = validatePairingPayload(payload)
    expect(result.valid).toBe(true)
  })

  it('fails for null', () => {
    const result = validatePairingPayload(null)
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('invalid_format')
  })

  it('fails for wrong version', () => {
    const result = validatePairingPayload({ ...sampleOffer, version: 99, checksum: 'abc' })
    expect(result.valid).toBe(false)
  })

  it('fails for missing roomId', () => {
    const { roomId: _r, ...noRoom } = sampleOffer
    const result = validatePairingPayload({ ...noRoom, checksum: 'abc' })
    expect(result.valid).toBe(false)
    expect(result.errors[0].field).toBe('roomId')
  })

  it('fails for missing sdp', () => {
    const { sdp: _s, ...noSdp } = sampleOffer
    const result = validatePairingPayload({ ...noSdp, checksum: 'abc' })
    expect(result.valid).toBe(false)
    expect(result.errors[0].field).toBe('sdp')
  })

  it('fails for missing checksum', () => {
    const result = validatePairingPayload(sampleOffer)
    expect(result.valid).toBe(false)
    expect(result.errors[0].field).toBe('checksum')
  })
})

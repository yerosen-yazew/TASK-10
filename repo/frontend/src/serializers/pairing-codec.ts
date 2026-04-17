// REQ: R19 — WebRTC manual pairing without signaling server
// REQ: R2 — Room link + on-screen pairing code

import type { PairingOffer, PairingAnswer, PairingPayload } from '@/models/collaboration'
import { PAIRING_PROTOCOL_VERSION } from '@/models/constants'
import type { ValidationResult } from '@/models/validation'
import { validResult, invalidResult } from '@/models/validation'

/**
 * Compute a SHA-256 hex digest of a string.
 * Used for integrity checking of pairing payloads.
 */
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Build the checksum input string from a pairing payload.
 * The checksum field itself is excluded.
 */
function buildChecksumInput(payload: Omit<PairingPayload, 'checksum'>): string {
  const ordered = {
    version: payload.version,
    type: payload.type,
    roomId: payload.roomId,
    peerId: payload.peerId,
    displayName: payload.displayName,
    timestamp: payload.timestamp,
    verificationCode: payload.verificationCode,
    sdp: payload.sdp,
    iceCandidates: payload.iceCandidates,
  }
  return JSON.stringify(ordered)
}

/**
 * Encode a pairing payload to a base64 string for copy/paste or QR display.
 */
export async function encodePairingPayload(
  payload: Omit<PairingOffer, 'checksum'> | Omit<PairingAnswer, 'checksum'>
): Promise<string> {
  const checksumInput = buildChecksumInput(payload)
  const checksum = await sha256Hex(checksumInput)
  const fullPayload = { ...payload, checksum }
  const json = JSON.stringify(fullPayload)
  return btoa(json)
}

/**
 * Decode a base64 pairing string back to a typed payload.
 * Returns null if decoding or validation fails.
 */
export function decodePairingPayload(encoded: string): PairingPayload | null {
  try {
    const json = atob(encoded)
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.version !== PAIRING_PROTOCOL_VERSION) return null
    if (parsed.type !== 'offer' && parsed.type !== 'answer') return null
    if (!parsed.roomId || !parsed.peerId || !parsed.sdp || !parsed.checksum) return null
    return parsed as PairingPayload
  } catch {
    return null
  }
}

/**
 * Verify the integrity checksum of a decoded pairing payload.
 */
export async function verifyPairingChecksum(payload: PairingPayload): Promise<boolean> {
  const { checksum, ...rest } = payload
  const expectedInput = buildChecksumInput(rest as Omit<PairingPayload, 'checksum'>)
  const expected = await sha256Hex(expectedInput)
  return checksum === expected
}

/**
 * Validate the structure and required fields of a pairing payload.
 */
export function validatePairingPayload(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return invalidResult('payload', 'Pairing payload is not a valid object.', 'invalid_format')
  }

  const p = payload as Record<string, unknown>

  if (p.version !== PAIRING_PROTOCOL_VERSION) {
    return invalidResult('version', `Unsupported protocol version: ${String(p.version)}.`, 'invalid_format', p.version)
  }
  if (p.type !== 'offer' && p.type !== 'answer') {
    return invalidResult('type', `Invalid payload type: "${String(p.type)}".`, 'invalid_format', p.type)
  }
  if (!p.roomId || typeof p.roomId !== 'string') {
    return invalidResult('roomId', 'Missing or invalid roomId.', 'required')
  }
  if (!p.peerId || typeof p.peerId !== 'string') {
    return invalidResult('peerId', 'Missing or invalid peerId.', 'required')
  }
  if (!p.sdp || typeof p.sdp !== 'string') {
    return invalidResult('sdp', 'Missing or invalid SDP.', 'required')
  }
  if (!p.checksum || typeof p.checksum !== 'string') {
    return invalidResult('checksum', 'Missing or invalid checksum.', 'required')
  }

  return validResult()
}

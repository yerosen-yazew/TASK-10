// REQ: Unique ID generation for all domain entities

/** Generate a UUID v4 using the browser's crypto API. */
export function generateId(): string {
  const cryptoApi = globalThis.crypto

  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }

  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('Secure random generator is unavailable in this environment.')
  }

  const bytes = new Uint8Array(16)
  cryptoApi.getRandomValues(bytes)

  // RFC 4122 version 4 UUID bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

/**
 * Generate a short human-readable verification code for pairing.
 * Format: "FORGE-XXXX" where X is a hex character.
 */
export function generateVerificationCode(): string {
  const bytes = new Uint8Array(2)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join('')
  return `FORGE-${hex}`
}

/**
 * Generate a short pairing code for room join.
 * Format: "XXXX-XXXX" where X is alphanumeric (uppercase).
 */
export function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I, O, 0, 1 to avoid confusion
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const code = Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('')
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

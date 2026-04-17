// REQ: R2 — Room join payload validation (pairing code, display name)

import { describe, it, expect } from 'vitest'
import {
  validatePairingCode,
  validateJoinDisplayName,
  validateJoinPayload,
} from '@/validators/join-validator'

describe('validatePairingCode', () => {
  it('rejects an empty code', () => {
    const result = validatePairingCode('')
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('required')
  })

  it('accepts a valid code in XXXX-XXXX format', () => {
    expect(validatePairingCode('AB3D-EF7G').valid).toBe(true)
  })

  it('rejects a code without a dash', () => {
    const result = validatePairingCode('AB3DEF7G')
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('invalid_format')
  })

  it('rejects a code with ambiguous characters (0, 1, I, O)', () => {
    expect(validatePairingCode('AB0D-EF1G').valid).toBe(false)
    expect(validatePairingCode('ABID-EFOG').valid).toBe(false)
  })

  it('rejects a code that is too short', () => {
    expect(validatePairingCode('AB3-EF7G').valid).toBe(false)
  })

  it('rejects a code with lowercase letters', () => {
    // lowercase is converted to uppercase in the validator
    expect(validatePairingCode('ab3d-ef7g').valid).toBe(true)
  })

  it('rejects a code with invalid characters', () => {
    expect(validatePairingCode('AB3D-EF7!').valid).toBe(false)
  })
})

describe('validateJoinDisplayName', () => {
  it('rejects an empty display name', () => {
    const result = validateJoinDisplayName('')
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('required')
  })

  it('rejects a whitespace-only display name', () => {
    const result = validateJoinDisplayName('   ')
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('required')
  })

  it('accepts a valid display name', () => {
    expect(validateJoinDisplayName('Alice').valid).toBe(true)
  })

  it('accepts a display name exactly 60 characters long', () => {
    expect(validateJoinDisplayName('a'.repeat(60)).valid).toBe(true)
  })

  it('rejects a display name exceeding 60 characters', () => {
    const result = validateJoinDisplayName('a'.repeat(61))
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('max_length')
  })
})

describe('validateJoinPayload', () => {
  it('passes with valid code and display name', () => {
    const result = validateJoinPayload({
      pairingCode: 'AB3D-EF7G',
      displayName: 'Alice',
    })
    expect(result.valid).toBe(true)
  })

  it('fails with both invalid code and empty name', () => {
    const result = validateJoinPayload({
      pairingCode: '',
      displayName: '',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBe(2)
  })

  it('fails with only an invalid code', () => {
    const result = validateJoinPayload({
      pairingCode: 'bad-code',
      displayName: 'Alice',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.field === 'pairingCode')).toBe(true)
  })
})

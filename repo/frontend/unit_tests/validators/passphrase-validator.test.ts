// REQ: R12 — Passphrase minimum 8 characters
import { describe, it, expect } from 'vitest'
import { validatePassphrase } from '@/validators/passphrase-validator'
import { MIN_PASSPHRASE_LENGTH } from '@/models/constants'

describe('validatePassphrase', () => {
  it('passes for a valid 8-character passphrase', () => {
    const result = validatePassphrase('abcdefgh')
    expect(result.valid).toBe(true)
  })

  it('passes for a long passphrase', () => {
    const result = validatePassphrase('this is a very long passphrase with many characters')
    expect(result.valid).toBe(true)
  })

  it('fails for a 7-character passphrase', () => {
    const result = validatePassphrase('abcdefg')
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('min_length')
  })

  it('fails for an empty string', () => {
    const result = validatePassphrase('')
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('required')
  })

  it('fails for a single character', () => {
    const result = validatePassphrase('x')
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('min_length')
  })

  it('passes at exactly the minimum length', () => {
    const passphrase = 'x'.repeat(MIN_PASSPHRASE_LENGTH)
    const result = validatePassphrase(passphrase)
    expect(result.valid).toBe(true)
  })

  it('fails at one below the minimum length', () => {
    const passphrase = 'x'.repeat(MIN_PASSPHRASE_LENGTH - 1)
    const result = validatePassphrase(passphrase)
    expect(result.valid).toBe(false)
  })
})

// REQ: R1 — Room creation payload validation

import { describe, it, expect } from 'vitest'
import {
  validateRoomName,
  validateRoomDescription,
  validateRoomCreatePayload,
} from '@/validators/room-create-validator'

describe('validateRoomName', () => {
  it('rejects an empty name', () => {
    const result = validateRoomName('')
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('required')
  })

  it('rejects a whitespace-only name', () => {
    const result = validateRoomName('   ')
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('required')
  })

  it('accepts a valid name', () => {
    expect(validateRoomName('Design Sprint').valid).toBe(true)
  })

  it('accepts a name exactly 100 characters long', () => {
    expect(validateRoomName('a'.repeat(100)).valid).toBe(true)
  })

  it('rejects a name exceeding 100 characters', () => {
    const result = validateRoomName('a'.repeat(101))
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('max_length')
  })
})

describe('validateRoomDescription', () => {
  it('accepts an empty description', () => {
    expect(validateRoomDescription('').valid).toBe(true)
  })

  it('accepts a description exactly 500 characters long', () => {
    expect(validateRoomDescription('x'.repeat(500)).valid).toBe(true)
  })

  it('rejects a description exceeding 500 characters', () => {
    const result = validateRoomDescription('x'.repeat(501))
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('max_length')
  })
})

describe('validateRoomCreatePayload', () => {
  it('passes with valid name and empty description', () => {
    const result = validateRoomCreatePayload({
      name: 'Team Room',
      description: '',
      settings: { requireApproval: false, enableSecondReviewer: false },
    })
    expect(result.valid).toBe(true)
  })

  it('aggregates errors for both invalid name and description', () => {
    const result = validateRoomCreatePayload({
      name: '',
      description: 'x'.repeat(501),
      settings: { requireApproval: false, enableSecondReviewer: false },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })

  it('returns name error only when description is valid', () => {
    const result = validateRoomCreatePayload({
      name: '',
      description: 'Valid description',
      settings: { requireApproval: true, enableSecondReviewer: false },
    })
    expect(result.valid).toBe(false)
    expect(result.errors.every((e) => e.field === 'name')).toBe(true)
  })
})

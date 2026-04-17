// REQ: R6 — 2,000 element cap, 5 MB per image, 50 images per room
import { describe, it, expect } from 'vitest'
import {
  validateElementCount,
  validateImageSize,
  validateImageCount,
} from '@/validators/element-validators'
import {
  MAX_ELEMENTS_PER_ROOM,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGES_PER_ROOM,
} from '@/models/constants'

describe('validateElementCount', () => {
  it('passes at zero elements', () => {
    expect(validateElementCount(0).valid).toBe(true)
  })

  it('passes under the limit', () => {
    expect(validateElementCount(1000).valid).toBe(true)
  })

  it('passes at one below the limit', () => {
    expect(validateElementCount(MAX_ELEMENTS_PER_ROOM - 1).valid).toBe(true)
  })

  it('fails at exactly the limit', () => {
    const result = validateElementCount(MAX_ELEMENTS_PER_ROOM)
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('max_count')
  })

  it('fails above the limit', () => {
    expect(validateElementCount(3000).valid).toBe(false)
  })
})

describe('validateImageSize', () => {
  it('passes for a small image (1 KB)', () => {
    expect(validateImageSize(1024).valid).toBe(true)
  })

  it('passes at exactly 5 MB', () => {
    expect(validateImageSize(MAX_IMAGE_SIZE_BYTES).valid).toBe(true)
  })

  it('fails at 5 MB + 1 byte', () => {
    const result = validateImageSize(MAX_IMAGE_SIZE_BYTES + 1)
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('max_size')
  })

  it('fails for a 10 MB image', () => {
    expect(validateImageSize(10 * 1024 * 1024).valid).toBe(false)
  })

  it('passes for zero bytes', () => {
    expect(validateImageSize(0).valid).toBe(true)
  })
})

describe('validateImageCount', () => {
  it('passes at zero images', () => {
    expect(validateImageCount(0).valid).toBe(true)
  })

  it('passes under the limit', () => {
    expect(validateImageCount(25).valid).toBe(true)
  })

  it('passes at one below the limit', () => {
    expect(validateImageCount(MAX_IMAGES_PER_ROOM - 1).valid).toBe(true)
  })

  it('fails at exactly the limit', () => {
    const result = validateImageCount(MAX_IMAGES_PER_ROOM)
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('max_count')
  })

  it('fails above the limit', () => {
    expect(validateImageCount(100).valid).toBe(false)
  })
})

// REQ: R8 — 5,000 message retention, 3 pinned max
import { describe, it, expect } from 'vitest'
import {
  calculateMessagePruneCount,
  validatePinnedCount,
} from '@/validators/chat-validators'
import { MAX_CHAT_MESSAGES_RETAINED, MAX_PINNED_MESSAGES } from '@/models/constants'

describe('calculateMessagePruneCount', () => {
  it('returns 0 when under the limit', () => {
    expect(calculateMessagePruneCount(1000)).toBe(0)
  })

  it('returns 0 at exactly the limit', () => {
    expect(calculateMessagePruneCount(MAX_CHAT_MESSAGES_RETAINED)).toBe(0)
  })

  it('returns 1 when one over the limit', () => {
    expect(calculateMessagePruneCount(MAX_CHAT_MESSAGES_RETAINED + 1)).toBe(1)
  })

  it('returns correct count when well over the limit', () => {
    expect(calculateMessagePruneCount(MAX_CHAT_MESSAGES_RETAINED + 500)).toBe(500)
  })

  it('returns 0 at zero messages', () => {
    expect(calculateMessagePruneCount(0)).toBe(0)
  })
})

describe('validatePinnedCount', () => {
  it('passes at zero pins', () => {
    expect(validatePinnedCount(0).valid).toBe(true)
  })

  it('passes at one pin', () => {
    expect(validatePinnedCount(1).valid).toBe(true)
  })

  it('passes at two pins', () => {
    expect(validatePinnedCount(2).valid).toBe(true)
  })

  it('fails at exactly the limit', () => {
    const result = validatePinnedCount(MAX_PINNED_MESSAGES)
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('max_count')
  })

  it('fails above the limit', () => {
    expect(validatePinnedCount(5).valid).toBe(false)
  })
})

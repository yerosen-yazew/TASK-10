// REQ: R7 — 200 comments per thread
import { describe, it, expect } from 'vitest'
import { validateCommentCount } from '@/validators/comment-validators'
import { MAX_COMMENTS_PER_THREAD } from '@/models/constants'

describe('validateCommentCount', () => {
  it('passes at zero comments', () => {
    expect(validateCommentCount(0).valid).toBe(true)
  })

  it('passes under the limit', () => {
    expect(validateCommentCount(100).valid).toBe(true)
  })

  it('passes at one below the limit', () => {
    expect(validateCommentCount(MAX_COMMENTS_PER_THREAD - 1).valid).toBe(true)
  })

  it('fails at exactly the limit', () => {
    const result = validateCommentCount(MAX_COMMENTS_PER_THREAD)
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('max_count')
  })

  it('fails above the limit', () => {
    expect(validateCommentCount(300).valid).toBe(false)
  })
})

// REQ: R7 — 200 comments per thread

import { MAX_COMMENTS_PER_THREAD } from '@/models/constants'
import type { ValidationResult } from '@/models/validation'
import { validResult, invalidResult } from '@/models/validation'

/**
 * Validate that a comment thread has not exceeded the maximum comment count.
 * @param currentCommentCount Number of comments currently in the thread.
 */
export function validateCommentCount(currentCommentCount: number): ValidationResult {
  if (currentCommentCount >= MAX_COMMENTS_PER_THREAD) {
    return invalidResult(
      'commentCount',
      `Thread has reached the maximum of ${MAX_COMMENTS_PER_THREAD} comments.`,
      'max_count',
      currentCommentCount
    )
  }
  return validResult()
}

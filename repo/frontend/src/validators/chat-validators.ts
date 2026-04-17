// REQ: R8 — 5,000 message retention, 3 pinned max

import {
  MAX_CHAT_MESSAGES_RETAINED,
  MAX_PINNED_MESSAGES,
} from '@/models/constants'
import type { ValidationResult } from '@/models/validation'
import { validResult, invalidResult } from '@/models/validation'

/**
 * Calculate how many old messages should be pruned to stay within retention limit.
 * @param currentMessageCount Total messages currently stored for the room.
 * @returns Number of oldest messages to remove (0 if within limit).
 */
export function calculateMessagePruneCount(currentMessageCount: number): number {
  return Math.max(0, currentMessageCount - MAX_CHAT_MESSAGES_RETAINED)
}

/**
 * Validate that the room has not exceeded the maximum pinned message count.
 * @param currentPinnedCount Number of currently pinned messages.
 */
export function validatePinnedCount(currentPinnedCount: number): ValidationResult {
  if (currentPinnedCount >= MAX_PINNED_MESSAGES) {
    return invalidResult(
      'pinnedCount',
      `Room has reached the maximum of ${MAX_PINNED_MESSAGES} pinned messages.`,
      'max_count',
      currentPinnedCount
    )
  }
  return validResult()
}

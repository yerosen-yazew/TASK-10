// REQ: R12 — Local-only passphrase with minimum 8 characters

import { MIN_PASSPHRASE_LENGTH } from '@/models/constants'
import type { ValidationResult } from '@/models/validation'
import { validResult, invalidResult } from '@/models/validation'

/**
 * Validate a passphrase meets the minimum length requirement.
 * @param passphrase The raw passphrase text.
 */
export function validatePassphrase(passphrase: string): ValidationResult {
  if (!passphrase || passphrase.length === 0) {
    return invalidResult(
      'passphrase',
      'Passphrase is required.',
      'required'
    )
  }
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return invalidResult(
      'passphrase',
      `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`,
      'min_length',
      passphrase.length
    )
  }
  return validResult()
}

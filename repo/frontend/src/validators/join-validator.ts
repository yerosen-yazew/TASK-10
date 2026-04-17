// REQ: R2 — Room join payload validation (pairing code, display name)

import type { ValidationResult } from '@/models/validation'
import { validResult, invalidResult, mergeResults } from '@/models/validation'

/** Payload for joining a room via pairing code. */
export interface JoinPayload {
  pairingCode: string
  displayName: string
}

/** Maximum allowed length for a join display name. */
const MAX_DISPLAY_NAME_LENGTH = 60

/** Expected format for a pairing code: XXXX-XXXX (uppercase safe charset, no I, O, 0, 1). */
const PAIRING_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/

/**
 * Validate a room pairing code.
 * Format: XXXX-XXXX where X is from the safe charset (no I, O, 0, 1).
 */
export function validatePairingCode(code: string): ValidationResult {
  const trimmed = code.trim().toUpperCase()
  if (!trimmed) {
    return invalidResult('pairingCode', 'Pairing code is required.', 'required')
  }
  if (!PAIRING_CODE_PATTERN.test(trimmed)) {
    return invalidResult(
      'pairingCode',
      'Pairing code format is invalid. Expected format: XXXX-XXXX (e.g., AB3D-EF7G).',
      'invalid_format',
      code
    )
  }
  return validResult()
}

/**
 * Validate the display name for a join request.
 * Required, max 60 characters.
 */
export function validateJoinDisplayName(displayName: string): ValidationResult {
  const trimmed = displayName.trim()
  if (!trimmed) {
    return invalidResult('displayName', 'Display name is required.', 'required')
  }
  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    return invalidResult(
      'displayName',
      `Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`,
      'max_length',
      trimmed.length
    )
  }
  return validResult()
}

/**
 * Validate a complete room join payload.
 */
export function validateJoinPayload(payload: JoinPayload): ValidationResult {
  return mergeResults(
    validatePairingCode(payload.pairingCode),
    validateJoinDisplayName(payload.displayName)
  )
}

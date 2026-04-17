// REQ: Shared validation types used across all validators in the ForgeRoom SPA.

export type ErrorCode =
  | 'required'
  | 'min_length'
  | 'max_length'
  | 'max_count'
  | 'max_size'
  | 'invalid_format'
  | 'invalid_transition'
  | 'duplicate'
  | 'not_found'
  | 'unauthorized'
  | 'conflict'
  | 'cap_exceeded'

export interface FieldError {
  field: string
  message: string
  code: ErrorCode
  value?: unknown
}

export interface ValidationResult {
  valid: boolean
  errors: FieldError[]
}

/** Helper to create a passing validation result. */
export function validResult(): ValidationResult {
  return { valid: true, errors: [] }
}

/** Helper to create a failing validation result with one error. */
export function invalidResult(field: string, message: string, code: ErrorCode, value?: unknown): ValidationResult {
  return {
    valid: false,
    errors: [{ field, message, code, value }],
  }
}

/** Merge multiple validation results into one. */
export function mergeResults(...results: ValidationResult[]): ValidationResult {
  const errors: FieldError[] = []
  for (const r of results) {
    errors.push(...r.errors)
  }
  return {
    valid: errors.length === 0,
    errors,
  }
}

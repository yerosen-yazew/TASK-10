// REQ: Shared validation result helpers are stable across validators and engines

import { describe, expect, it } from 'vitest'
import {
  invalidResult,
  mergeResults,
  validResult,
  type ValidationResult,
} from '@/models/validation'

describe('validation model helpers', () => {
  it('validResult returns a pass state with no errors', () => {
    expect(validResult()).toEqual({ valid: true, errors: [] })
  })

  it('invalidResult builds one structured field error', () => {
    const result = invalidResult('name', 'Name is required.', 'required', null)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      {
        field: 'name',
        message: 'Name is required.',
        code: 'required',
        value: null,
      },
    ])
  })

  it('mergeResults returns valid=true when every input is valid', () => {
    const merged = mergeResults(validResult(), validResult())
    expect(merged).toEqual({ valid: true, errors: [] })
  })

  it('mergeResults aggregates errors and marks invalid when any input fails', () => {
    const a: ValidationResult = invalidResult('roomId', 'Missing room.', 'required')
    const b: ValidationResult = invalidResult('state', 'Invalid transition.', 'invalid_transition')

    const merged = mergeResults(a, b)

    expect(merged.valid).toBe(false)
    expect(merged.errors).toHaveLength(2)
    expect(merged.errors.map((e) => e.field)).toEqual(['roomId', 'state'])
  })

  it('mergeResults with no inputs defaults to a valid empty result', () => {
    expect(mergeResults()).toEqual({ valid: true, errors: [] })
  })
})

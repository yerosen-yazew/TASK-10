// REQ: utils barrel exports

import { describe, expect, it } from 'vitest'
import * as utils from '@/utils'

describe('utils barrel', () => {
  it('re-exports core utility functions and logger', () => {
    expect(typeof utils.generateId).toBe('function')
    expect(typeof utils.generateVerificationCode).toBe('function')
    expect(typeof utils.generatePairingCode).toBe('function')
    expect(typeof utils.estimateJsonSize).toBe('function')
    expect(typeof utils.formatBytes).toBe('function')
    expect(typeof utils.nowISO).toBe('function')
    expect(typeof utils.parseISO).toBe('function')
    expect(typeof utils.msElapsedSince).toBe('function')
    expect(typeof utils.isOlderThan).toBe('function')
    expect(typeof utils.logger).toBe('object')
  })
})

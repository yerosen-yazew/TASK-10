// REQ: R11 — Safe logging utility: must not leak passphrase / sensitive field values

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger, __setLoggerLevelForTests } from '@/utils/logger'

describe('logger', () => {
  beforeEach(() => {
    __setLoggerLevelForTests('debug')
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'debug').mockImplementation(() => {})
  })

  afterEach(() => {
    __setLoggerLevelForTests(null)
    vi.restoreAllMocks()
  })

  it('calls console.info for info level', () => {
    logger.info('test message')
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[INFO]'),
      'test message'
    )
  })

  it('calls console.warn for warn level', () => {
    logger.warn('warning')
    expect(console.warn).toHaveBeenCalled()
  })

  it('suppresses info logs when level is warn', () => {
    __setLoggerLevelForTests('warn')
    logger.info('should be hidden')
    expect(console.info).not.toHaveBeenCalled()
  })

  it('still emits warnings when level is warn', () => {
    __setLoggerLevelForTests('warn')
    logger.warn('visible warning')
    expect(console.warn).toHaveBeenCalledOnce()
  })

  it('calls console.error for error level', () => {
    logger.error('error occurred')
    expect(console.error).toHaveBeenCalled()
  })

  it('redacts passphrase field in objects', () => {
    logger.info('login attempt', { profileId: 'p1', passphrase: 'secret123' })
    const call = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0]
    const sanitizedArg = call[2] as Record<string, unknown>
    expect(sanitizedArg.passphrase).toBe('[REDACTED]')
    expect(sanitizedArg.profileId).toBe('p1')
  })

  it('redacts salt field in objects', () => {
    logger.info('verifier created', { salt: 'abc123base64', verifier: 'xyz' })
    const call = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0]
    const sanitized = call[2] as Record<string, unknown>
    expect(sanitized.salt).toBe('[REDACTED]')
    expect(sanitized.verifier).toBe('[REDACTED]')
  })

  it('does not redact non-sensitive fields', () => {
    logger.info('room event', { roomId: 'r1', action: 'create' })
    const call = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0]
    const sanitized = call[2] as Record<string, unknown>
    expect(sanitized.roomId).toBe('r1')
    expect(sanitized.action).toBe('create')
  })

  it('handles null and undefined arguments without throwing', () => {
    expect(() => logger.info('null test', null, undefined)).not.toThrow()
  })

  it('handles nested sensitive keys', () => {
    logger.info('deep object', { user: { id: 'u1', passphrase: 'hunter2' } })
    const call = (console.info as ReturnType<typeof vi.spyOn>).mock.calls[0]
    const sanitized = call[2] as { user: Record<string, unknown> }
    expect(sanitized.user.passphrase).toBe('[REDACTED]')
    expect(sanitized.user.id).toBe('u1')
  })
})

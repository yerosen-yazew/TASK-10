// REQ: R13 — Inactivity lock + forced sign-out use ISO timestamp helpers

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  nowISO,
  parseISO,
  msElapsedSince,
  isOlderThan,
} from '@/utils/date-utils'

describe('date-utils', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('nowISO', () => {
    it('returns a string parseable by Date', () => {
      const iso = nowISO()
      expect(typeof iso).toBe('string')
      expect(Number.isNaN(Date.parse(iso))).toBe(false)
    })

    it('matches the ISO 8601 Z-suffixed format', () => {
      expect(nowISO()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })
  })

  describe('parseISO', () => {
    it('returns a Date for a valid ISO string', () => {
      const d = parseISO('2026-04-17T12:34:56.789Z')
      expect(d).toBeInstanceOf(Date)
      expect(d!.getUTCFullYear()).toBe(2026)
    })

    it('returns null for malformed input', () => {
      expect(parseISO('not-a-date')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(parseISO('')).toBeNull()
    })
  })

  describe('msElapsedSince', () => {
    it('returns 0 for invalid input', () => {
      expect(msElapsedSince('garbage')).toBe(0)
    })

    it('returns a positive elapsed-ms count for past timestamps', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-04-17T12:00:00Z'))
      const then = new Date('2026-04-17T11:00:00Z').toISOString()
      expect(msElapsedSince(then)).toBe(60 * 60 * 1000)
    })
  })

  describe('isOlderThan', () => {
    it('returns true when elapsed > threshold', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-04-17T12:00:00Z'))
      const then = new Date('2026-04-17T10:00:00Z').toISOString()
      expect(isOlderThan(then, 60 * 60 * 1000)).toBe(true)
    })

    it('returns false when elapsed < threshold', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-04-17T12:00:00Z'))
      const then = new Date('2026-04-17T11:55:00Z').toISOString()
      expect(isOlderThan(then, 60 * 60 * 1000)).toBe(false)
    })

    it('returns false for invalid ISO (elapsed is 0)', () => {
      expect(isOlderThan('garbage', 1000)).toBe(false)
    })
  })
})

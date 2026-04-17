// REQ: R2 — Pairing code + verification code generation for room join flow

import { describe, it, expect } from 'vitest'
import {
  generateId,
  generatePairingCode,
  generateVerificationCode,
} from '@/utils/id-generator'

describe('id-generator', () => {
  describe('generateId', () => {
    it('returns a non-empty string', () => {
      const id = generateId()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('returns a UUID-formatted string (8-4-4-4-12 hex)', () => {
      const id = generateId()
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    })

    it('produces no collisions across 1000 calls', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 1000; i++) ids.add(generateId())
      expect(ids.size).toBe(1000)
    })
  })

  describe('generateVerificationCode', () => {
    it('matches FORGE-XXXX uppercase hex pattern', () => {
      const code = generateVerificationCode()
      expect(code).toMatch(/^FORGE-[0-9A-F]{4}$/)
    })

    it('produces different codes across calls', () => {
      const codes = new Set<string>()
      for (let i = 0; i < 200; i++) codes.add(generateVerificationCode())
      expect(codes.size).toBeGreaterThan(100)
    })
  })

  describe('generatePairingCode', () => {
    it('matches XXXX-XXXX grouped alphanumeric pattern', () => {
      const code = generatePairingCode()
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    })

    it('omits visually confusing characters (I, O, 0, 1)', () => {
      for (let i = 0; i < 200; i++) {
        const code = generatePairingCode()
        expect(code).not.toMatch(/[IO01]/)
      }
    })

    it('produces no collisions across 500 calls', () => {
      const codes = new Set<string>()
      for (let i = 0; i < 500; i++) codes.add(generatePairingCode())
      expect(codes.size).toBe(500)
    })
  })
})

// REQ: R20 — Backup size estimation + image size checks rely on byte sizing helpers

import { describe, it, expect } from 'vitest'
import { estimateJsonSize, formatBytes } from '@/utils/size-utils'
import { MAX_BACKUP_SIZE_BYTES } from '@/models/constants'

describe('size-utils', () => {
  describe('estimateJsonSize', () => {
    it('returns the UTF-8 byte length of the JSON representation', () => {
      const obj = { a: 'hello' }
      const expected = new TextEncoder().encode(JSON.stringify(obj)).byteLength
      expect(estimateJsonSize(obj)).toBe(expected)
    })

    it('handles empty objects', () => {
      expect(estimateJsonSize({})).toBe(2) // "{}"
    })

    it('handles arrays', () => {
      expect(estimateJsonSize([])).toBe(2) // "[]"
    })

    it('counts multi-byte UTF-8 characters correctly', () => {
      // "é" is 2 bytes in UTF-8
      const obj = { s: 'é' }
      expect(estimateJsonSize(obj)).toBeGreaterThan(JSON.stringify(obj).length)
    })

    it('returns a value well below MAX_BACKUP_SIZE_BYTES for small payloads', () => {
      expect(estimateJsonSize({ hello: 'world' })).toBeLessThan(MAX_BACKUP_SIZE_BYTES)
    })

    it('handles nested structures', () => {
      const nested = { a: { b: { c: [1, 2, 3] } } }
      expect(estimateJsonSize(nested)).toBe(
        new TextEncoder().encode(JSON.stringify(nested)).byteLength,
      )
    })
  })

  describe('formatBytes', () => {
    it('returns "0 B" for zero', () => {
      expect(formatBytes(0)).toBe('0 B')
    })

    it('formats bytes under 1024 as B', () => {
      expect(formatBytes(512)).toBe('512 B')
    })

    it('formats KB with one decimal place', () => {
      expect(formatBytes(2048)).toBe('2.0 KB')
    })

    it('formats MB with one decimal place', () => {
      expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    })

    it('formats GB with one decimal place', () => {
      expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.0 GB')
    })

    it('formats MAX_BACKUP_SIZE_BYTES as "200.0 MB"', () => {
      expect(formatBytes(MAX_BACKUP_SIZE_BYTES)).toBe('200.0 MB')
    })
  })
})

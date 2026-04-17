// REQ: R15 — LocalStorage helpers for preferences + session flags

import { describe, it, expect, beforeEach } from 'vitest'
import {
  LS_KEYS,
  lsGetString,
  lsSetString,
  lsGetJSON,
  lsSetJSON,
  lsRemove,
  lsClearAll,
} from '@/services/local-storage-keys'
import { LS_PREFIX } from '@/models/constants'

describe('local-storage-keys', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('LS_KEYS namespace', () => {
    it('prefixes all key constants with LS_PREFIX', () => {
      for (const key of Object.values(LS_KEYS)) {
        expect(key.startsWith(LS_PREFIX)).toBe(true)
      }
    })

    it('defines unique keys', () => {
      const values = Object.values(LS_KEYS)
      expect(new Set(values).size).toBe(values.length)
    })
  })

  describe('lsGetString / lsSetString', () => {
    it('roundtrips a string', () => {
      lsSetString(LS_KEYS.THEME, 'dark')
      expect(lsGetString(LS_KEYS.THEME)).toBe('dark')
    })

    it('returns null for a missing key', () => {
      expect(lsGetString('forgeroom:missing')).toBeNull()
    })
  })

  describe('lsGetJSON / lsSetJSON', () => {
    it('roundtrips an object', () => {
      const value = { roomId: 'r1', name: 'R1', lastAccessed: '2026-01-01T00:00:00.000Z' }
      lsSetJSON(LS_KEYS.RECENT_ROOMS, [value])
      expect(lsGetJSON<typeof value[]>(LS_KEYS.RECENT_ROOMS)).toEqual([value])
    })

    it('returns null for a missing key', () => {
      expect(lsGetJSON(LS_KEYS.RECENT_ROOMS)).toBeNull()
    })

    it('returns null (never throws) on malformed JSON', () => {
      localStorage.setItem(LS_KEYS.RECENT_ROOMS, '{not json')
      expect(lsGetJSON(LS_KEYS.RECENT_ROOMS)).toBeNull()
    })
  })

  describe('lsRemove / lsClearAll', () => {
    it('lsRemove deletes a single key', () => {
      lsSetString(LS_KEYS.THEME, 'dark')
      lsRemove(LS_KEYS.THEME)
      expect(lsGetString(LS_KEYS.THEME)).toBeNull()
    })

    it('lsClearAll removes only ForgeRoom-prefixed keys', () => {
      lsSetString(LS_KEYS.THEME, 'dark')
      localStorage.setItem('unrelated', 'keep')
      lsClearAll()
      expect(lsGetString(LS_KEYS.THEME)).toBeNull()
      expect(localStorage.getItem('unrelated')).toBe('keep')
    })
  })
})

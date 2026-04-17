// REQ: R17 — Keep latest 48 snapshots
import { describe, it, expect } from 'vitest'
import {
  calculateSnapshotPruneCount,
  getSnapshotIdsToPrune,
} from '@/validators/snapshot-validators'
import { MAX_SNAPSHOTS_RETAINED } from '@/models/constants'

describe('calculateSnapshotPruneCount', () => {
  it('returns 0 when under the limit', () => {
    expect(calculateSnapshotPruneCount(20)).toBe(0)
  })

  it('returns 0 at exactly the limit', () => {
    expect(calculateSnapshotPruneCount(MAX_SNAPSHOTS_RETAINED)).toBe(0)
  })

  it('returns 1 when one over the limit', () => {
    expect(calculateSnapshotPruneCount(MAX_SNAPSHOTS_RETAINED + 1)).toBe(1)
  })

  it('returns correct count when well over', () => {
    expect(calculateSnapshotPruneCount(MAX_SNAPSHOTS_RETAINED + 10)).toBe(10)
  })

  it('returns 0 at zero', () => {
    expect(calculateSnapshotPruneCount(0)).toBe(0)
  })
})

describe('getSnapshotIdsToPrune', () => {
  it('returns empty array when under limit', () => {
    const ids = ['a', 'b', 'c']
    expect(getSnapshotIdsToPrune(ids, 3)).toEqual([])
  })

  it('returns the oldest IDs when over limit', () => {
    const ids = ['oldest', 'old', 'new', 'newest']
    // Simulate being 2 over a limit of 2
    expect(getSnapshotIdsToPrune(ids, MAX_SNAPSHOTS_RETAINED + 2)).toEqual(ids.slice(0, 2))
  })

  it('returns empty array when at exactly the limit', () => {
    const ids = Array.from({ length: MAX_SNAPSHOTS_RETAINED }, (_, i) => `snap-${i}`)
    expect(getSnapshotIdsToPrune(ids, MAX_SNAPSHOTS_RETAINED)).toEqual([])
  })
})

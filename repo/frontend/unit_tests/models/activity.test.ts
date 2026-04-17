// REQ: R10 — Activity filter map integrity for feed tabs

import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_FILTER_TYPES,
  ActivityEventType,
  ActivityFilter,
} from '@/models/activity'

describe('activity model filter mapping', () => {
  it('maps every ActivityFilter key to an event-type array', () => {
    const filterValues = Object.values(ActivityFilter)

    for (const filter of filterValues) {
      expect(Array.isArray(ACTIVITY_FILTER_TYPES[filter])).toBe(true)
    }
  })

  it('all filter entries contain only valid ActivityEventType values', () => {
    const validTypes = new Set(Object.values(ActivityEventType))

    for (const types of Object.values(ACTIVITY_FILTER_TYPES)) {
      for (const type of types) {
        expect(validTypes.has(type)).toBe(true)
      }
    }
  })

  it('All filter includes every activity event type', () => {
    const allTypes = Object.values(ActivityEventType).sort()
    const mapped = [...ACTIVITY_FILTER_TYPES[ActivityFilter.All]].sort()

    expect(mapped).toEqual(allTypes)
  })

  it('non-All filters are non-empty subsets', () => {
    const subsetFilters = Object.values(ActivityFilter).filter(
      (filter) => filter !== ActivityFilter.All
    )

    for (const filter of subsetFilters) {
      expect(ACTIVITY_FILTER_TYPES[filter].length).toBeGreaterThan(0)
      expect(ACTIVITY_FILTER_TYPES[filter].length).toBeLessThanOrEqual(
        ACTIVITY_FILTER_TYPES[ActivityFilter.All].length
      )
    }
  })
})

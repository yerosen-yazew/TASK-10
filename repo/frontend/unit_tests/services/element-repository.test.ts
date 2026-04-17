// REQ: R5 — Whiteboard element persistence query helpers
// REQ: R6 — countByRoom used for 2,000-cap validation

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { elementRepository } from '@/services/element-repository'
import { ElementType, type WhiteboardElement } from '@/models/element'

function makeSticky(id: string, roomId: string, zIndex: number): WhiteboardElement {
  const now = new Date().toISOString()
  return {
    elementId: id,
    roomId,
    type: ElementType.StickyNote,
    position: { x: 0, y: 0 },
    zIndex,
    createdBy: 'u-1',
    createdAt: now,
    updatedAt: now,
    dimensions: { width: 100, height: 100 },
    text: '',
    backgroundColor: '#fff',
    textColor: '#000',
    fontSize: 14,
  }
}

const room1 = [
  makeSticky('e1', 'room-1', 1),
  makeSticky('e2', 'room-1', 5),
  makeSticky('e3', 'room-1', 3),
]
const room2 = [makeSticky('e4', 'room-2', 9)]

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(elementRepository as unknown as { query: typeof elementRepository['query'] }, 'query')
    .mockImplementation(async (_indexName: string, value: IDBValidKey) => {
      if (value === 'room-1') return [...room1]
      if (value === 'room-2') return [...room2]
      return []
    })
  vi.spyOn(
    elementRepository as unknown as { count: typeof elementRepository['count'] },
    'count'
  ).mockImplementation(async (_indexName?: string, value?: IDBValidKey) => {
    if (value === 'room-1') return room1.length
    if (value === 'room-2') return room2.length
    return 0
  })
})

describe('elementRepository.listByRoom', () => {
  it('returns only elements for the requested room', async () => {
    const elements = await elementRepository.listByRoom('room-1')
    expect(elements.map((e) => e.elementId).sort()).toEqual(['e1', 'e2', 'e3'])
  })

  it('returns an empty list for an unknown room', async () => {
    const elements = await elementRepository.listByRoom('nope')
    expect(elements).toEqual([])
  })
})

describe('elementRepository.countByRoom', () => {
  it('returns the count via the by-roomId index', async () => {
    expect(await elementRepository.countByRoom('room-1')).toBe(3)
    expect(await elementRepository.countByRoom('room-2')).toBe(1)
  })
})

describe('elementRepository.maxZIndexByRoom', () => {
  it('returns the highest zIndex for a room', async () => {
    expect(await elementRepository.maxZIndexByRoom('room-1')).toBe(5)
    expect(await elementRepository.maxZIndexByRoom('room-2')).toBe(9)
  })

  it('returns 0 when the room has no elements', async () => {
    expect(await elementRepository.maxZIndexByRoom('empty')).toBe(0)
  })
})

describe('elementRepository edge cases', () => {
  it('countByRoom returns 0 for an unknown room', async () => {
    expect(await elementRepository.countByRoom('never-seen')).toBe(0)
  })

  it('listByRoom does not leak elements across room boundaries', async () => {
    const oneList = await elementRepository.listByRoom('room-1')
    const twoList = await elementRepository.listByRoom('room-2')
    const overlap = oneList.filter((a) => twoList.some((b) => b.elementId === a.elementId))
    expect(overlap).toHaveLength(0)
  })
})

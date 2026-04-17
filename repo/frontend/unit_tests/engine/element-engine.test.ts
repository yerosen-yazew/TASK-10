// REQ: R5 — Sticky notes, arrows/connectors, pen strokes, image elements
// REQ: R6 — 2,000 element cap enforcement
// REQ: R10 — Create/edit/delete activity emission

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createSticky,
  createArrow,
  createPenStroke,
  updateElement,
  deleteElement,
  bringToFront,
  listElements,
  applyElementMutation,
} from '@/engine/element-engine'
import { ElementType, type WhiteboardElement } from '@/models/element'
import type { ActivityEvent } from '@/models/activity'
import { ActivityEventType } from '@/models/activity'

const elementStore = new Map<string, WhiteboardElement>()
const activityStore: ActivityEvent[] = []

vi.mock('@/services/element-repository', () => ({
  elementRepository: {
    put: vi.fn(async (el: WhiteboardElement) => {
      elementStore.set(el.elementId, el)
    }),
    getById: vi.fn(async (id: string) => elementStore.get(id)),
    delete: vi.fn(async (id: string) => {
      elementStore.delete(id)
    }),
    listByRoom: vi.fn(async (roomId: string) =>
      Array.from(elementStore.values()).filter((e) => e.roomId === roomId)
    ),
    countByRoom: vi.fn(async (roomId: string) =>
      Array.from(elementStore.values()).filter((e) => e.roomId === roomId).length
    ),
    maxZIndexByRoom: vi.fn(async (roomId: string) => {
      let max = 0
      for (const e of elementStore.values()) {
        if (e.roomId === roomId && e.zIndex > max) max = e.zIndex
      }
      return max
    }),
  },
}))

vi.mock('@/services/activity-repository', () => ({
  activityRepository: {
    put: vi.fn(async (e: ActivityEvent) => {
      activityStore.push(e)
    }),
  },
}))

const actor = { memberId: 'u-1', displayName: 'User 1' }

beforeEach(() => {
  elementStore.clear()
  activityStore.length = 0
})

describe('createSticky', () => {
  it('creates a sticky note with zIndex assigned and emits activity', async () => {
    const result = await createSticky({
      roomId: 'room-1',
      position: { x: 10, y: 20 },
      dimensions: { width: 200, height: 200 },
      text: 'hello',
      backgroundColor: '#ffe',
      textColor: '#000',
      fontSize: 14,
      actor,
    })
    expect(result.validation.valid).toBe(true)
    expect(result.element?.type).toBe(ElementType.StickyNote)
    expect(result.element?.zIndex).toBe(1)
    expect(activityStore[0].type).toBe(ActivityEventType.ElementCreated)
  })
})

describe('createArrow + createPenStroke', () => {
  it('creates an arrow with both endpoints', async () => {
    const result = await createArrow({
      roomId: 'room-1',
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 10, y: 10 },
      strokeColor: '#000',
      strokeWidth: 2,
      arrowHeadStyle: 'triangle',
      actor,
    })
    expect(result.validation.valid).toBe(true)
    expect(result.element?.type).toBe(ElementType.Arrow)
  })

  it('creates a pen stroke with the provided points', async () => {
    const result = await createPenStroke({
      roomId: 'room-1',
      position: { x: 0, y: 0 },
      points: [
        { x: 0, y: 0, timestamp: 1 },
        { x: 1, y: 1, timestamp: 2 },
      ],
      strokeColor: '#000',
      strokeWidth: 2,
      actor,
    })
    expect(result.validation.valid).toBe(true)
    expect(result.element?.type).toBe(ElementType.PenStroke)
  })
})

describe('element cap enforcement', () => {
  it('accepts exactly the max number of elements (2,000)', async () => {
    for (let i = 0; i < 1999; i++) {
      elementStore.set(`el-${i}`, {
        elementId: `el-${i}`,
        roomId: 'room-1',
        type: ElementType.StickyNote,
        position: { x: 0, y: 0 },
        zIndex: i,
        createdBy: 'u-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dimensions: { width: 100, height: 100 },
        text: '',
        backgroundColor: '#fff',
        textColor: '#000',
        fontSize: 14,
      })
    }
    // Room has 1,999 — one more is allowed (brings it to 2,000).
    const ok = await createSticky({
      roomId: 'room-1',
      position: { x: 0, y: 0 },
      dimensions: { width: 100, height: 100 },
      text: '',
      backgroundColor: '#fff',
      textColor: '#000',
      fontSize: 14,
      actor,
    })
    expect(ok.validation.valid).toBe(true)
  })

  it('rejects the 2,001st element', async () => {
    for (let i = 0; i < 2000; i++) {
      elementStore.set(`el-${i}`, {
        elementId: `el-${i}`,
        roomId: 'room-1',
        type: ElementType.StickyNote,
        position: { x: 0, y: 0 },
        zIndex: i,
        createdBy: 'u-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dimensions: { width: 100, height: 100 },
        text: '',
        backgroundColor: '#fff',
        textColor: '#000',
        fontSize: 14,
      })
    }
    const fail = await createSticky({
      roomId: 'room-1',
      position: { x: 0, y: 0 },
      dimensions: { width: 100, height: 100 },
      text: '',
      backgroundColor: '#fff',
      textColor: '#000',
      fontSize: 14,
      actor,
    })
    expect(fail.validation.valid).toBe(false)
    expect(fail.validation.errors[0].code).toBe('max_count')
  })
})

describe('updateElement / deleteElement / bringToFront', () => {
  it('updates an existing element and emits an edit event', async () => {
    const created = await createSticky({
      roomId: 'room-1',
      position: { x: 0, y: 0 },
      dimensions: { width: 100, height: 100 },
      text: 'a',
      backgroundColor: '#fff',
      textColor: '#000',
      fontSize: 14,
      actor,
    })
    activityStore.length = 0
    const updated = await updateElement(
      created.element!.elementId,
      { position: { x: 50, y: 50 } } as any,
      actor
    )
    expect(updated.validation.valid).toBe(true)
    expect(activityStore.some((e) => e.type === ActivityEventType.ElementUpdated)).toBe(true)
  })

  it('deletes an element and emits a delete event', async () => {
    const created = await createSticky({
      roomId: 'room-1',
      position: { x: 0, y: 0 },
      dimensions: { width: 100, height: 100 },
      text: 'a',
      backgroundColor: '#fff',
      textColor: '#000',
      fontSize: 14,
      actor,
    })
    activityStore.length = 0
    const result = await deleteElement(created.element!.elementId, actor)
    expect(result.validation.valid).toBe(true)
    expect(elementStore.has(created.element!.elementId)).toBe(false)
    expect(activityStore.some((e) => e.type === ActivityEventType.ElementDeleted)).toBe(true)
  })

  it('bringToFront raises zIndex above other elements', async () => {
    const a = await createSticky({
      roomId: 'room-1',
      position: { x: 0, y: 0 },
      dimensions: { width: 100, height: 100 },
      text: 'a',
      backgroundColor: '#fff',
      textColor: '#000',
      fontSize: 14,
      actor,
    })
    const b = await createSticky({
      roomId: 'room-1',
      position: { x: 0, y: 0 },
      dimensions: { width: 100, height: 100 },
      text: 'b',
      backgroundColor: '#fff',
      textColor: '#000',
      fontSize: 14,
      actor,
    })
    const updated = await bringToFront(a.element!.elementId, actor)
    expect(updated.element?.zIndex).toBeGreaterThan(b.element!.zIndex)
  })

  it('returns not_found when updating or deleting an unknown element', async () => {
    const up = await updateElement('missing', { position: { x: 0, y: 0 } } as any, actor)
    expect(up.validation.errors[0].code).toBe('not_found')
    const del = await deleteElement('missing', actor)
    expect(del.validation.errors[0].code).toBe('not_found')
  })
})

describe('listElements', () => {
  it('returns all elements for a room', async () => {
    await createSticky({
      roomId: 'room-1',
      position: { x: 0, y: 0 },
      dimensions: { width: 100, height: 100 },
      text: 'a',
      backgroundColor: '#fff',
      textColor: '#000',
      fontSize: 14,
      actor,
    })
    await createSticky({
      roomId: 'room-1',
      position: { x: 0, y: 0 },
      dimensions: { width: 100, height: 100 },
      text: 'b',
      backgroundColor: '#fff',
      textColor: '#000',
      fontSize: 14,
      actor,
    })
    const list = await listElements('room-1')
    expect(list).toHaveLength(2)
  })
})

describe('applyElementMutation', () => {
  it('applies remote update payload by replacing the element snapshot', async () => {
    const created = await createSticky({
      roomId: 'room-1',
      position: { x: 0, y: 0 },
      dimensions: { width: 100, height: 100 },
      text: 'before',
      backgroundColor: '#fff',
      textColor: '#000',
      fontSize: 14,
      actor,
    })

    const updated = {
      ...created.element!,
      text: 'after',
    }
    const result = await applyElementMutation('room-1', {
      operation: 'update',
      elementId: updated.elementId,
      element: updated,
    })

    expect(result.valid).toBe(true)
    const list = await listElements('room-1')
    expect((list[0] as any).text).toBe('after')
  })

  it('applies remote delete payload', async () => {
    const created = await createSticky({
      roomId: 'room-1',
      position: { x: 0, y: 0 },
      dimensions: { width: 100, height: 100 },
      text: 'to-delete',
      backgroundColor: '#fff',
      textColor: '#000',
      fontSize: 14,
      actor,
    })

    const result = await applyElementMutation('room-1', {
      operation: 'delete',
      elementId: created.element!.elementId,
    })
    expect(result.valid).toBe(true)
    const list = await listElements('room-1')
    expect(list).toHaveLength(0)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { useElementStore } from '@/stores/element-store'
import { setupNoMockTestEnv, seedActiveHostRoom } from '../integration/no-mock-test-harness'
import { elementRepository } from '@/services/element-repository'
import { ElementType } from '@/models/element'
import { RoomRole } from '@/models/room'

function actor(memberId: string, displayName = 'Element Actor') {
  return { memberId, displayName, role: RoomRole.Host }
}

describe('element-store no-mock integration', () => {
  beforeEach(async () => {
    await setupNoMockTestEnv()
  })

  it('loads persisted elements into store', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useElementStore()

    await store.createSticky({
      roomId: room.roomId,
      position: { x: 10, y: 20 },
      dimensions: { width: 180, height: 120 },
      text: 'Persisted',
      backgroundColor: '#fef9c3',
      textColor: '#1e293b',
      fontSize: 14,
      actor: actor(host.profileId, host.displayName),
    })

    const freshStore = useElementStore()
    freshStore.elements = []
    await freshStore.loadElements(room.roomId)

    expect(freshStore.elements.length).toBe(1)
    expect(freshStore.elements[0].type).toBe(ElementType.StickyNote)
  })

  it('creates sticky note with valid payload', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useElementStore()

    const result = await store.createSticky({
      roomId: room.roomId,
      position: { x: 30, y: 40 },
      dimensions: { width: 200, height: 140 },
      text: 'Sticky text',
      backgroundColor: '#fde68a',
      textColor: '#111827',
      fontSize: 16,
      actor: actor(host.profileId, host.displayName),
    })

    expect(result.validation.valid).toBe(true)
    expect(result.element?.type).toBe(ElementType.StickyNote)
    expect(store.elements.length).toBe(1)
  })

  it('creates arrow element with valid payload', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useElementStore()

    const result = await store.createArrow({
      roomId: room.roomId,
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 120, y: 80 },
      strokeColor: '#1d4ed8',
      strokeWidth: 2,
      arrowHeadStyle: 'triangle',
      actor: actor(host.profileId, host.displayName),
    })

    expect(result.validation.valid).toBe(true)
    expect(result.element?.type).toBe(ElementType.Arrow)
  })

  it('creates pen stroke element with valid payload', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useElementStore()
    const now = Date.now()

    const result = await store.createPenStroke({
      roomId: room.roomId,
      position: { x: 5, y: 5 },
      points: [
        { x: 5, y: 5, timestamp: now },
        { x: 8, y: 10, timestamp: now + 1 },
      ],
      strokeColor: '#0f172a',
      strokeWidth: 3,
      actor: actor(host.profileId, host.displayName),
    })

    expect(result.validation.valid).toBe(true)
    expect(result.element?.type).toBe(ElementType.PenStroke)
  })

  it('ingests image and creates image element', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useElementStore()
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })

    const result = await store.ingestImage({
      roomId: room.roomId,
      blob,
      fileName: 'sample.png',
      mimeType: 'image/png',
      position: { x: 100, y: 120 },
      dimensions: { width: 220, height: 160 },
      actor: actor(host.profileId, host.displayName),
    })

    expect(result.validation.valid).toBe(true)
    expect(result.element?.type).toBe(ElementType.Image)
    expect(store.elements.some((el) => el.type === ElementType.Image)).toBe(true)
  })

  it('updates element fields while preserving identity', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useElementStore()

    const created = await store.createSticky({
      roomId: room.roomId,
      position: { x: 20, y: 20 },
      dimensions: { width: 160, height: 100 },
      text: 'before',
      backgroundColor: '#fef3c7',
      textColor: '#111827',
      fontSize: 14,
      actor: actor(host.profileId, host.displayName),
    })

    const updated = await store.updateElement(created.element!.elementId, { text: 'after' }, actor(host.profileId, host.displayName))

    expect(updated.validation.valid).toBe(true)
    expect(updated.element?.elementId).toBe(created.element!.elementId)
    expect((updated.element as any).text).toBe('after')
  })

  it('returns invalid result when updating a missing element', async () => {
    const { host } = await seedActiveHostRoom()
    const store = useElementStore()

    const result = await store.updateElement('missing-element', { text: 'x' }, actor(host.profileId, host.displayName))

    expect(result.validation.valid).toBe(false)
    expect(result.validation.errors[0]?.code).toBe('not_found')
  })

  it('deletes existing element from store and repository', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useElementStore()

    const created = await store.createSticky({
      roomId: room.roomId,
      position: { x: 1, y: 1 },
      dimensions: { width: 160, height: 100 },
      text: 'delete me',
      backgroundColor: '#fef3c7',
      textColor: '#111827',
      fontSize: 14,
      actor: actor(host.profileId, host.displayName),
    })

    const deleted = await store.deleteElement(created.element!.elementId, actor(host.profileId, host.displayName))

    expect(deleted.validation.valid).toBe(true)
    expect(store.elements.find((el) => el.elementId === created.element!.elementId)).toBeUndefined()
    expect(await elementRepository.getById(created.element!.elementId)).toBeUndefined()
  })

  it('returns invalid result when deleting unknown element', async () => {
    const { host } = await seedActiveHostRoom()
    const store = useElementStore()

    const deleted = await store.deleteElement('missing-element', actor(host.profileId, host.displayName))

    expect(deleted.validation.valid).toBe(false)
  })

  it('bringToFront increases z-index relative to existing elements', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useElementStore()

    const first = await store.createSticky({
      roomId: room.roomId,
      position: { x: 12, y: 12 },
      dimensions: { width: 160, height: 100 },
      text: 'first',
      backgroundColor: '#fef3c7',
      textColor: '#111827',
      fontSize: 14,
      actor: actor(host.profileId, host.displayName),
    })

    const second = await store.createSticky({
      roomId: room.roomId,
      position: { x: 15, y: 15 },
      dimensions: { width: 160, height: 100 },
      text: 'second',
      backgroundColor: '#fde68a',
      textColor: '#111827',
      fontSize: 14,
      actor: actor(host.profileId, host.displayName),
    })

    const result = await store.bringToFront(first.element!.elementId, actor(host.profileId, host.displayName))

    expect(result.validation.valid).toBe(true)
    expect((result.element as any).zIndex).toBeGreaterThan((second.element as any).zIndex)
  })

  it('assigns increasing z-index values across successive create operations', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useElementStore()

    const a = await store.createSticky({
      roomId: room.roomId,
      position: { x: 0, y: 0 },
      dimensions: { width: 120, height: 80 },
      text: 'a',
      backgroundColor: '#fef3c7',
      textColor: '#111827',
      fontSize: 12,
      actor: actor(host.profileId, host.displayName),
    })

    const b = await store.createSticky({
      roomId: room.roomId,
      position: { x: 1, y: 1 },
      dimensions: { width: 120, height: 80 },
      text: 'b',
      backgroundColor: '#fef3c7',
      textColor: '#111827',
      fontSize: 12,
      actor: actor(host.profileId, host.displayName),
    })

    expect((b.element as any).zIndex).toBeGreaterThan((a.element as any).zIndex)
  })

  it('persists all created element types to repository', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useElementStore()
    const now = Date.now()

    await store.createSticky({
      roomId: room.roomId,
      position: { x: 2, y: 2 },
      dimensions: { width: 140, height: 90 },
      text: 'sticky',
      backgroundColor: '#fef3c7',
      textColor: '#111827',
      fontSize: 12,
      actor: actor(host.profileId, host.displayName),
    })
    await store.createArrow({
      roomId: room.roomId,
      startPoint: { x: 2, y: 2 },
      endPoint: { x: 44, y: 44 },
      strokeColor: '#1d4ed8',
      strokeWidth: 2,
      arrowHeadStyle: 'triangle',
      actor: actor(host.profileId, host.displayName),
    })
    await store.createPenStroke({
      roomId: room.roomId,
      position: { x: 2, y: 2 },
      points: [{ x: 2, y: 2, timestamp: now }],
      strokeColor: '#111827',
      strokeWidth: 2,
      actor: actor(host.profileId, host.displayName),
    })

    const persisted = await elementRepository.listByRoom(room.roomId)
    expect(persisted.some((el) => el.type === ElementType.StickyNote)).toBe(true)
    expect(persisted.some((el) => el.type === ElementType.Arrow)).toBe(true)
    expect(persisted.some((el) => el.type === ElementType.PenStroke)).toBe(true)
  })
})

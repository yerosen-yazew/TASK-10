// REQ: R6 — 5 MB image cap and 50 images-per-room cap

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ingestImageFile } from '@/engine/image-engine'
import type { WhiteboardElement, ImageRecord } from '@/models/element'
import { ElementType } from '@/models/element'
import type { ActivityEvent } from '@/models/activity'
import { MAX_IMAGE_SIZE_BYTES, MAX_IMAGES_PER_ROOM } from '@/models/constants'

const elementStore = new Map<string, WhiteboardElement>()
const imageStore = new Map<string, ImageRecord>()
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

vi.mock('@/services/image-blob-repository', () => ({
  imageBlobRepository: {
    put: vi.fn(async (img: ImageRecord) => {
      imageStore.set(img.imageId, img)
    }),
    getById: vi.fn(async (id: string) => imageStore.get(id)),
    delete: vi.fn(async (id: string) => {
      imageStore.delete(id)
    }),
    listByRoom: vi.fn(async (roomId: string) =>
      Array.from(imageStore.values()).filter((i) => i.roomId === roomId)
    ),
    countByRoom: vi.fn(async (roomId: string) =>
      Array.from(imageStore.values()).filter((i) => i.roomId === roomId).length
    ),
    sumBytesByRoom: vi.fn(async (roomId: string) => {
      let total = 0
      for (const i of imageStore.values()) {
        if (i.roomId === roomId) total += i.fileSizeBytes
      }
      return total
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

function makeBlob(bytes: number, mimeType = 'image/png'): Blob {
  const data = new Uint8Array(bytes)
  return new Blob([data], { type: mimeType })
}

beforeEach(() => {
  elementStore.clear()
  imageStore.clear()
  activityStore.length = 0
})

describe('ingestImageFile', () => {
  it('accepts an image under 5 MB and creates both element and blob record', async () => {
    const blob = makeBlob(1024)
    const result = await ingestImageFile({
      roomId: 'room-1',
      blob,
      fileName: 'pic.png',
      mimeType: 'image/png',
      position: { x: 0, y: 0 },
      dimensions: { width: 100, height: 100 },
      actor,
    })
    expect(result.validation.valid).toBe(true)
    expect(result.element?.type).toBe(ElementType.Image)
    expect(result.imageRecord?.blob).toBe(blob)
    expect(imageStore.size).toBe(1)
  })

  it('rejects images larger than the 5 MB cap', async () => {
    const blob = makeBlob(MAX_IMAGE_SIZE_BYTES + 1)
    const result = await ingestImageFile({
      roomId: 'room-1',
      blob,
      fileName: 'big.png',
      mimeType: 'image/png',
      position: { x: 0, y: 0 },
      dimensions: { width: 100, height: 100 },
      actor,
    })
    expect(result.validation.valid).toBe(false)
    expect(result.validation.errors[0].field).toBe('imageSize')
  })

  it('rejects the 51st image in a room (uses MAX_IMAGES_PER_ROOM)', async () => {
    for (let i = 0; i < MAX_IMAGES_PER_ROOM; i++) {
      imageStore.set(`img-${i}`, {
        imageId: `img-${i}`,
        roomId: 'room-1',
        elementId: `el-${i}`,
        blob: makeBlob(10),
        fileName: `f-${i}.png`,
        mimeType: 'image/png',
        fileSizeBytes: 10,
        createdAt: new Date().toISOString(),
      })
    }
    const result = await ingestImageFile({
      roomId: 'room-1',
      blob: makeBlob(10),
      fileName: 'over.png',
      mimeType: 'image/png',
      position: { x: 0, y: 0 },
      dimensions: { width: 10, height: 10 },
      actor,
    })
    expect(result.validation.valid).toBe(false)
    expect(result.validation.errors.some((e) => e.field === 'imageCount')).toBe(true)
  })

  it('does not persist an element or blob when validation fails', async () => {
    const blob = makeBlob(MAX_IMAGE_SIZE_BYTES + 1)
    const before = { elements: elementStore.size, images: imageStore.size }
    await ingestImageFile({
      roomId: 'room-1',
      blob,
      fileName: 'big.png',
      mimeType: 'image/png',
      position: { x: 0, y: 0 },
      dimensions: { width: 100, height: 100 },
      actor,
    })
    expect(elementStore.size).toBe(before.elements)
    expect(imageStore.size).toBe(before.images)
  })

  it('persists the image at exactly MAX_IMAGE_SIZE_BYTES (boundary)', async () => {
    const blob = makeBlob(MAX_IMAGE_SIZE_BYTES)
    const result = await ingestImageFile({
      roomId: 'room-1',
      blob,
      fileName: 'right-at-cap.png',
      mimeType: 'image/png',
      position: { x: 0, y: 0 },
      dimensions: { width: 10, height: 10 },
      actor,
    })
    expect(result.validation.valid).toBe(true)
    expect(imageStore.size).toBe(1)
  })

  it('scopes the per-room count — another room is not affected', async () => {
    for (let i = 0; i < MAX_IMAGES_PER_ROOM; i++) {
      imageStore.set(`img-${i}`, {
        imageId: `img-${i}`,
        roomId: 'room-1',
        elementId: `el-${i}`,
        blob: makeBlob(10),
        fileName: `f-${i}.png`,
        mimeType: 'image/png',
        fileSizeBytes: 10,
        createdAt: new Date().toISOString(),
      })
    }
    const result = await ingestImageFile({
      roomId: 'room-2',
      blob: makeBlob(10),
      fileName: 'ok.png',
      mimeType: 'image/png',
      position: { x: 0, y: 0 },
      dimensions: { width: 10, height: 10 },
      actor,
    })
    expect(result.validation.valid).toBe(true)
  })

  it('deleteImageBlob returns invalid result when image id does not exist', async () => {
    const { deleteImageBlob } = await import('@/engine/image-engine')
    const result = await deleteImageBlob('missing-id')
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('not_found')
  })
})

// REQ: R6 — Image blob persistence, 50-per-room cap, 5 MB per image

import { describe, it, expect, beforeEach } from 'vitest'
import { imageBlobRepository } from '@/services/image-blob-repository'
import {
  DB_NAME,
  MAX_IMAGES_PER_ROOM,
  MAX_IMAGE_SIZE_BYTES,
} from '@/models/constants'
import type { ImageRecord } from '@/models/element'

async function resetDb() {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

function makeImage(
  roomId: string,
  imageId: string,
  bytes = 1024,
): ImageRecord {
  return {
    imageId,
    roomId,
    elementId: `el-${imageId}`,
    blob: new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
    fileName: `${imageId}.png`,
    mimeType: 'image/png',
    fileSizeBytes: bytes,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('imageBlobRepository', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('put + getById roundtrips an image record', async () => {
    await imageBlobRepository.put(makeImage('r1', 'img1'))
    const got = await imageBlobRepository.getById('img1')
    expect(got?.fileName).toBe('img1.png')
  })

  it('listByRoom returns only images for the given room', async () => {
    await imageBlobRepository.put(makeImage('r1', 'a'))
    await imageBlobRepository.put(makeImage('r1', 'b'))
    await imageBlobRepository.put(makeImage('r2', 'c'))
    const list = await imageBlobRepository.listByRoom('r1')
    expect(list.map((i) => i.imageId).sort()).toEqual(['a', 'b'])
  })

  it('countByRoom matches the MAX_IMAGES_PER_ROOM cap enforcement count', async () => {
    for (let i = 0; i < 3; i++) {
      await imageBlobRepository.put(makeImage('r1', `i${i}`))
    }
    const count = await imageBlobRepository.countByRoom('r1')
    expect(count).toBe(3)
    expect(count).toBeLessThan(MAX_IMAGES_PER_ROOM)
  })

  it('sumBytesByRoom totals fileSizeBytes across images', async () => {
    await imageBlobRepository.put(makeImage('r1', 'a', 1000))
    await imageBlobRepository.put(makeImage('r1', 'b', 2500))
    expect(await imageBlobRepository.sumBytesByRoom('r1')).toBe(3500)
  })

  it('sumBytesByRoom returns 0 for an empty room', async () => {
    expect(await imageBlobRepository.sumBytesByRoom('empty')).toBe(0)
  })

  it('persists fileSizeBytes under MAX_IMAGE_SIZE_BYTES', async () => {
    const small = MAX_IMAGE_SIZE_BYTES - 1
    await imageBlobRepository.put(makeImage('r1', 'ok', small))
    expect((await imageBlobRepository.getById('ok'))?.fileSizeBytes).toBe(small)
  })

  it('delete removes an image record', async () => {
    await imageBlobRepository.put(makeImage('r1', 'del'))
    await imageBlobRepository.delete('del')
    expect(await imageBlobRepository.getById('del')).toBeUndefined()
  })
})

// REQ: R6 — Image blob persistence, 50-per-room cap, 5 MB per image

import { BaseRepository } from './base-repository'
import type { ImageRecord } from '@/models/element'

/** Repository for image binary blobs (stored separately from element metadata). */
class ImageBlobRepository extends BaseRepository<ImageRecord, string> {
  protected readonly storeName = 'images'

  /** List all image records for a room. */
  async listByRoom(roomId: string): Promise<ImageRecord[]> {
    return this.query('by-roomId', roomId)
  }

  /** Count images in a room. */
  async countByRoom(roomId: string): Promise<number> {
    return this.count('by-roomId', roomId)
  }

  /** Sum the total bytes of all images in a room. */
  async sumBytesByRoom(roomId: string): Promise<number> {
    const images = await this.listByRoom(roomId)
    let total = 0
    for (const img of images) {
      total += img.fileSizeBytes
    }
    return total
  }
}

/** Singleton image blob repository. */
export const imageBlobRepository = new ImageBlobRepository()

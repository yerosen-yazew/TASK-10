// REQ: R5 — Whiteboard element persistence
// REQ: R6 — 2,000 element cap enforcement (count queries)

import { BaseRepository } from './base-repository'
import type { WhiteboardElement } from '@/models/element'

/** Repository for whiteboard elements (sticky notes, arrows, pen strokes, images). */
class ElementRepository extends BaseRepository<WhiteboardElement, string> {
  protected readonly storeName = 'elements'

  /** List all elements for a room. */
  async listByRoom(roomId: string): Promise<WhiteboardElement[]> {
    return this.query('by-roomId', roomId)
  }

  /** Count all elements in a room (for cap validation). */
  async countByRoom(roomId: string): Promise<number> {
    return this.count('by-roomId', roomId)
  }

  /** Compute the highest zIndex currently used in a room (0 if empty). */
  async maxZIndexByRoom(roomId: string): Promise<number> {
    const elements = await this.listByRoom(roomId)
    let max = 0
    for (const el of elements) {
      if (el.zIndex > max) max = el.zIndex
    }
    return max
  }
}

/** Singleton element repository. */
export const elementRepository = new ElementRepository()

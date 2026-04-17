// REQ: R7 — Threaded comments anchored to elements

import { BaseRepository } from './base-repository'
import type { CommentThread } from '@/models/comment'

/** Repository for comment threads (one thread per whiteboard element). */
class CommentThreadRepository extends BaseRepository<CommentThread, string> {
  protected readonly storeName = 'commentThreads'

  /** List all threads for a room. */
  async listByRoom(roomId: string): Promise<CommentThread[]> {
    return this.query('by-roomId', roomId)
  }

  /** Find the thread anchored to a specific element, if any. */
  async findByElement(roomId: string, elementId: string): Promise<CommentThread | undefined> {
    const rows = await this.query('by-roomId-elementId', [roomId, elementId])
    return rows[0]
  }
}

/** Singleton comment thread repository. */
export const commentThreadRepository = new CommentThreadRepository()

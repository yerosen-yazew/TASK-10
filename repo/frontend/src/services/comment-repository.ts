// REQ: R7 — 200 comments per thread

import { BaseRepository } from './base-repository'
import type { Comment } from '@/models/comment'

/** Repository for individual comments. */
class CommentRepository extends BaseRepository<Comment, string> {
  protected readonly storeName = 'comments'

  /** List comments in a thread (chronological via createdAt field). */
  async listByThread(threadId: string): Promise<Comment[]> {
    const rows = await this.query('by-threadId', threadId)
    return rows.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  /** Count comments in a thread (for 200-cap validation). */
  async countByThread(threadId: string): Promise<number> {
    return this.count('by-threadId', threadId)
  }

  /** List all comments belonging to a room (used by backup export). */
  async listByRoom(roomId: string): Promise<Comment[]> {
    return this.query('by-roomId', roomId)
  }
}

/** Singleton comment repository. */
export const commentRepository = new CommentRepository()

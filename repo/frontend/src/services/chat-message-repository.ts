// REQ: R8 — 5,000 message retention (oldest trimmed) per room

import { BaseRepository } from './base-repository'
import type { ChatMessage } from '@/models/chat'

/** Repository for chat messages. */
class ChatMessageRepository extends BaseRepository<ChatMessage, string> {
  protected readonly storeName = 'chatMessages'

  /** List messages for a room in ascending createdAt order. */
  async listByRoom(roomId: string): Promise<ChatMessage[]> {
    const rows = await this.query('by-roomId', roomId)
    return rows.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  /** Count messages in a room. */
  async countByRoom(roomId: string): Promise<number> {
    return this.count('by-roomId', roomId)
  }

  /**
   * Delete the oldest messages over the cap for a room.
   * Returns the number of rows removed.
   */
  async deleteOldestExcess(roomId: string, cap: number): Promise<number> {
    const all = await this.listByRoom(roomId)
    const excess = all.length - cap
    if (excess <= 0) return 0
    const toRemove = all.slice(0, excess)
    for (const msg of toRemove) {
      await this.delete(msg.messageId)
    }
    return toRemove.length
  }
}

/** Singleton chat message repository. */
export const chatMessageRepository = new ChatMessageRepository()

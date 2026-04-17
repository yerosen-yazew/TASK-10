// REQ: R8 — 3 pinned messages max per room

import { BaseRepository } from './base-repository'
import type { PinnedMessage } from '@/models/chat'

/** Repository for pinned message references. Composite key: [roomId, messageId]. */
class PinnedMessageRepository extends BaseRepository<PinnedMessage, [string, string]> {
  protected readonly storeName = 'pinnedMessages'

  /** List pinned messages for a room. */
  async listByRoom(roomId: string): Promise<PinnedMessage[]> {
    return this.query('by-roomId', roomId)
  }

  /** Count pinned messages in a room (for 3-cap validation). */
  async countByRoom(roomId: string): Promise<number> {
    return this.count('by-roomId', roomId)
  }

  /** Look up a pinned record for a specific message. */
  async find(roomId: string, messageId: string): Promise<PinnedMessage | undefined> {
    return this.getById([roomId, messageId])
  }
}

/** Singleton pinned message repository. */
export const pinnedMessageRepository = new PinnedMessageRepository()

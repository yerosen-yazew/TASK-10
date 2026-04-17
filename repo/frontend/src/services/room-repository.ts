// REQ: R1 — Room persistence (IndexedDB)

import { BaseRepository } from './base-repository'
import type { Room } from '@/models/room'

/** Repository for room metadata. */
class RoomRepository extends BaseRepository<Room, string> {
  protected readonly storeName = 'rooms'

  /** List every room stored locally. */
  async listAll(): Promise<Room[]> {
    return this.getAll()
  }
}

/** Singleton room repository. */
export const roomRepository = new RoomRepository()

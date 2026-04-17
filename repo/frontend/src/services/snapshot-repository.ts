// REQ: R17 — Snapshots every 5 min, keep 48, one-click rollback

import { BaseRepository } from './base-repository'
import type { Snapshot } from '@/models/snapshot'

/** Repository for full room state snapshots. */
class SnapshotRepository extends BaseRepository<Snapshot, string> {
  protected readonly storeName = 'snapshots'

  /** List snapshots for a room ordered oldest→newest by createdAt. */
  async listByRoom(roomId: string): Promise<Snapshot[]> {
    const rows = await this.query('by-roomId', roomId)
    return rows.slice().sort((a, b) => {
      if (a.createdAt === b.createdAt) return a.sequenceNumber - b.sequenceNumber
      return a.createdAt.localeCompare(b.createdAt)
    })
  }

  /** Count snapshots in a room. */
  async countByRoom(roomId: string): Promise<number> {
    return this.count('by-roomId', roomId)
  }

  /**
   * Delete the oldest snapshots over the cap for a room.
   * Returns the number of rows removed.
   */
  async deleteOldestExcess(roomId: string, cap: number): Promise<number> {
    const all = await this.listByRoom(roomId)
    const excess = all.length - cap
    if (excess <= 0) return 0
    const toRemove = all.slice(0, excess)
    for (const s of toRemove) {
      await this.delete(s.snapshotId)
    }
    return toRemove.length
  }
}

/** Singleton snapshot repository. */
export const snapshotRepository = new SnapshotRepository()

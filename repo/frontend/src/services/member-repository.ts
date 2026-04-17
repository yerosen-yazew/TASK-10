// REQ: R1 — Room membership persistence
// REQ: R3 — request→approval→active→leave lifecycle

import { BaseRepository } from './base-repository'
import { MembershipState } from '@/models/room'
import type { MemberRecord } from '@/models/room'

/** Repository for per-room member records. Composite key: [roomId, memberId]. */
class MemberRepository extends BaseRepository<MemberRecord, [string, string]> {
  protected readonly storeName = 'members'

  /** List every member record for a room (all states). */
  async listByRoom(roomId: string): Promise<MemberRecord[]> {
    return this.query('by-roomId', roomId)
  }

  /** List members currently in Active state for a room. */
  async listActiveByRoom(roomId: string): Promise<MemberRecord[]> {
    return this.query('by-roomId-state', [roomId, MembershipState.Active])
  }

  /** Count currently Active members in a room. */
  async countActiveByRoom(roomId: string): Promise<number> {
    return this.count('by-roomId-state', [roomId, MembershipState.Active])
  }

  /** Fetch a specific member record. */
  async find(roomId: string, memberId: string): Promise<MemberRecord | undefined> {
    return this.getById([roomId, memberId])
  }
}

/** Singleton member repository. */
export const memberRepository = new MemberRepository()

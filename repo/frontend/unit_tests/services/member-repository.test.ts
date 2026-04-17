// REQ: R1, R3 — Membership persistence and index queries

import { describe, it, expect, beforeEach } from 'vitest'
import { memberRepository } from '@/services/member-repository'
import { DB_NAME, MAX_ROOM_MEMBERS } from '@/models/constants'
import { MembershipState, RoomRole } from '@/models/room'
import type { MemberRecord } from '@/models/room'

async function resetDb() {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

function makeMember(
  roomId: string,
  memberId: string,
  state = MembershipState.Active,
): MemberRecord {
  return {
    roomId,
    memberId,
    displayName: memberId,
    avatarColor: '#123456',
    role: RoomRole.Participant,
    state,
    joinedAt: '2026-01-01T00:00:00.000Z',
    stateChangedAt: '2026-01-01T00:00:00.000Z',
    approvals: [],
  }
}

describe('memberRepository', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('put + find retrieves a member by composite key', async () => {
    await memberRepository.put(makeMember('r1', 'm1'))
    const got = await memberRepository.find('r1', 'm1')
    expect(got?.displayName).toBe('m1')
  })

  it('listByRoom returns every member across states', async () => {
    await memberRepository.put(makeMember('r1', 'active', MembershipState.Active))
    await memberRepository.put(makeMember('r1', 'left', MembershipState.Left))
    await memberRepository.put(
      makeMember('r1', 'pending', MembershipState.Requested),
    )
    await memberRepository.put(makeMember('r2', 'other', MembershipState.Active))
    const members = await memberRepository.listByRoom('r1')
    expect(members.length).toBe(3)
  })

  it('listActiveByRoom returns only Active members', async () => {
    await memberRepository.put(makeMember('r1', 'a1', MembershipState.Active))
    await memberRepository.put(makeMember('r1', 'a2', MembershipState.Active))
    await memberRepository.put(makeMember('r1', 'l1', MembershipState.Left))
    await memberRepository.put(
      makeMember('r1', 'p1', MembershipState.PendingSecondApproval),
    )
    const active = await memberRepository.listActiveByRoom('r1')
    expect(active.map((m) => m.memberId).sort()).toEqual(['a1', 'a2'])
  })

  it('countActiveByRoom returns the Active count used for the 20-member cap', async () => {
    for (let i = 0; i < 5; i++) {
      await memberRepository.put(
        makeMember('r1', `m${i}`, MembershipState.Active),
      )
    }
    await memberRepository.put(makeMember('r1', 'gone', MembershipState.Left))
    const count = await memberRepository.countActiveByRoom('r1')
    expect(count).toBe(5)
    expect(count).toBeLessThanOrEqual(MAX_ROOM_MEMBERS)
  })

  it('find returns undefined for unknown (roomId, memberId)', async () => {
    expect(await memberRepository.find('r1', 'nobody')).toBeUndefined()
  })
})

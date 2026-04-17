// REQ: R1 — Max 20 active members
// REQ: R3 — request→approval→active→leave state transitions
// REQ: R4 — Optional second Reviewer approval at 15+
// REQ: R10 — Membership activity emission

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  requestJoin,
  approveJoin,
  denyJoin,
  leaveRoom,
  assertMemberCanAct,
  applyMembershipMutation,
} from '@/engine/membership-engine'
import {
  MembershipState,
  RoomRole,
  type MemberRecord,
  type Room,
  type JoinRequest,
} from '@/models/room'
import type { ActivityEvent } from '@/models/activity'
import { ActivityEventType } from '@/models/activity'

const memberStore = new Map<string, MemberRecord>()
const roomStore = new Map<string, Room>()
const activityStore: ActivityEvent[] = []

const key = (roomId: string, memberId: string) => `${roomId}::${memberId}`

vi.mock('@/services/member-repository', () => ({
  memberRepository: {
    put: vi.fn(async (m: MemberRecord) => {
      memberStore.set(key(m.roomId, m.memberId), m)
    }),
    find: vi.fn(async (roomId: string, memberId: string) =>
      memberStore.get(key(roomId, memberId))
    ),
    listByRoom: vi.fn(async (roomId: string) =>
      Array.from(memberStore.values()).filter((m) => m.roomId === roomId)
    ),
    listActiveByRoom: vi.fn(async (roomId: string) =>
      Array.from(memberStore.values()).filter(
        (m) => m.roomId === roomId && m.state === MembershipState.Active
      )
    ),
    countActiveByRoom: vi.fn(async (roomId: string) =>
      Array.from(memberStore.values()).filter(
        (m) => m.roomId === roomId && m.state === MembershipState.Active
      ).length
    ),
  },
}))

vi.mock('@/services/room-repository', () => ({
  roomRepository: {
    put: vi.fn(async (r: Room) => {
      roomStore.set(r.roomId, r)
    }),
    getById: vi.fn(async (id: string) => roomStore.get(id)),
  },
}))

vi.mock('@/services/activity-repository', () => ({
  activityRepository: {
    put: vi.fn(async (e: ActivityEvent) => {
      activityStore.push(e)
    }),
  },
}))

function makeRoom(settings: { requireApproval: boolean; enableSecondReviewer: boolean }): Room {
  return {
    roomId: 'room-1',
    name: 'Test',
    description: '',
    hostProfileId: 'host',
    pairingCode: 'TEST-CODE',
    settings,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function makeRequest(requesterId: string): JoinRequest {
  return {
    roomId: 'room-1',
    requesterId,
    displayName: `User-${requesterId}`,
    avatarColor: '#abcdef',
    requestedRole: RoomRole.Participant,
    requestedAt: new Date().toISOString(),
    pairingCode: 'TEST-CODE',
  }
}

function seedActive(n: number): void {
  for (let i = 0; i < n; i++) {
    const memberId = `active-${i}`
    const now = new Date().toISOString()
    memberStore.set(key('room-1', memberId), {
      roomId: 'room-1',
      memberId,
      displayName: `A${i}`,
      avatarColor: '#000',
      role: i === 0 ? RoomRole.Host : RoomRole.Participant,
      state: MembershipState.Active,
      joinedAt: now,
      stateChangedAt: now,
      approvals: [],
    })
  }
}

beforeEach(() => {
  memberStore.clear()
  roomStore.clear()
  activityStore.length = 0
})

describe('requestJoin', () => {
  it('creates a Requested member when the room requires approval', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: true, enableSecondReviewer: false }))
    const result = await requestJoin('room-1', makeRequest('u-1'))
    expect(result.validation.valid).toBe(true)
    expect(result.member?.state).toBe(MembershipState.Requested)
  })

  it('auto-activates when requireApproval is false', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: false, enableSecondReviewer: false }))
    const result = await requestJoin('room-1', makeRequest('u-1'))
    expect(result.validation.valid).toBe(true)
    expect(result.member?.state).toBe(MembershipState.Active)
    expect(activityStore.some((e) => e.type === ActivityEventType.MemberJoined)).toBe(true)
  })

  it('rejects when the room is not found', async () => {
    const result = await requestJoin('unknown', makeRequest('u-1'))
    expect(result.validation.valid).toBe(false)
    expect(result.validation.errors[0].code).toBe('not_found')
  })

  it('prevents duplicate requests for the same requester', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: true, enableSecondReviewer: false }))
    await requestJoin('room-1', makeRequest('u-1'))
    const result = await requestJoin('room-1', makeRequest('u-1'))
    expect(result.validation.valid).toBe(false)
    expect(result.validation.errors[0].code).toBe('duplicate')
  })
})

describe('approveJoin', () => {
  it('advances Requested → Active with single-approval rooms', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: true, enableSecondReviewer: false }))
    await requestJoin('room-1', makeRequest('u-1'))
    const result = await approveJoin('room-1', 'u-1', {
      memberId: 'host',
      displayName: 'Host',
      role: RoomRole.Host,
    })
    expect(result.validation.valid).toBe(true)
    expect(result.member?.state).toBe(MembershipState.Active)
    expect(result.member?.approvals).toHaveLength(1)
    expect(result.member?.approvals[0]).toMatchObject({
      approverId: 'host',
      action: 'approve',
      isSecondApproval: false,
      approverRole: RoomRole.Host,
    })
  })

  it('requires a second approver when room has 15+ and dual-reviewer is enabled', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: true, enableSecondReviewer: true }))
    seedActive(15)
    await requestJoin('room-1', makeRequest('u-1'))

    const first = await approveJoin('room-1', 'u-1', {
      memberId: 'reviewer-1',
      displayName: 'R1',
      role: RoomRole.Reviewer,
    })
    expect(first.validation.valid).toBe(true)
    expect(first.member?.state).toBe(MembershipState.PendingSecondApproval)
    expect(first.member?.approvals[0].isSecondApproval).toBe(false)

    const second = await approveJoin('room-1', 'u-1', {
      memberId: 'reviewer-2',
      displayName: 'R2',
      role: RoomRole.Reviewer,
    })
    expect(second.validation.valid).toBe(true)
    expect(second.member?.state).toBe(MembershipState.Active)
    expect(second.member?.approvals[1].isSecondApproval).toBe(true)
  })

  it('blocks the same approver from acting as the second approver', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: true, enableSecondReviewer: true }))
    seedActive(15)
    await requestJoin('room-1', makeRequest('u-1'))
    await approveJoin('room-1', 'u-1', {
      memberId: 'reviewer-1',
      displayName: 'R1',
      role: RoomRole.Reviewer,
    })
    const result = await approveJoin('room-1', 'u-1', {
      memberId: 'reviewer-1',
      displayName: 'R1',
      role: RoomRole.Reviewer,
    })
    expect(result.validation.valid).toBe(false)
    expect(result.validation.errors[0].code).toBe('duplicate')
  })

  it('skips the second-approval step when the room is below 15 active members', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: true, enableSecondReviewer: true }))
    seedActive(14)
    await requestJoin('room-1', makeRequest('u-1'))
    const result = await approveJoin('room-1', 'u-1', {
      memberId: 'reviewer-1',
      displayName: 'R1',
      role: RoomRole.Reviewer,
    })
    expect(result.validation.valid).toBe(true)
    expect(result.member?.state).toBe(MembershipState.Active)
  })

  it('rejects approval when room is already at 20 active members', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: true, enableSecondReviewer: false }))
    seedActive(20)
    await requestJoin('room-1', makeRequest('u-1'))
    const result = await approveJoin('room-1', 'u-1', {
      memberId: 'host',
      displayName: 'Host',
      role: RoomRole.Host,
    })
    expect(result.validation.valid).toBe(false)
    expect(result.validation.errors[0].code).toBe('max_count')
  })

  it('records approval audit metadata (approver id, role, timestamp, isSecondApproval flag)', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: true, enableSecondReviewer: false }))
    await requestJoin('room-1', makeRequest('u-1'))
    const result = await approveJoin('room-1', 'u-1', {
      memberId: 'host',
      displayName: 'Host',
      role: RoomRole.Host,
    })
    const record = result.member?.approvals[0]
    expect(record?.approverId).toBe('host')
    expect(record?.approverRole).toBe(RoomRole.Host)
    expect(record?.timestamp).toBeTruthy()
    expect(record?.isSecondApproval).toBe(false)
    expect(activityStore.some((e) => e.type === ActivityEventType.MemberApproved)).toBe(true)
    expect(activityStore.some((e) => e.type === ActivityEventType.MemberJoined)).toBe(true)
  })

  it('rejects approval for a member in a non-requesting state', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: true, enableSecondReviewer: false }))
    await requestJoin('room-1', makeRequest('u-1'))
    await approveJoin('room-1', 'u-1', { memberId: 'host', displayName: 'Host', role: RoomRole.Host })
    // Member is now Active — approving again should fail.
    const result = await approveJoin('room-1', 'u-1', {
      memberId: 'host',
      displayName: 'Host',
      role: RoomRole.Host,
    })
    expect(result.validation.valid).toBe(false)
    expect(result.validation.errors[0].code).toBe('invalid_transition')
  })
})

describe('denyJoin', () => {
  it('marks the member as Rejected and records the rejection', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: true, enableSecondReviewer: false }))
    await requestJoin('room-1', makeRequest('u-1'))
    const result = await denyJoin(
      'room-1',
      'u-1',
      { memberId: 'host', displayName: 'Host', role: RoomRole.Host },
      'spam'
    )
    expect(result.validation.valid).toBe(true)
    expect(result.member?.state).toBe(MembershipState.Rejected)
    expect(result.member?.approvals[0].action).toBe('reject')
    expect(activityStore.some((e) => e.type === ActivityEventType.MemberRejected)).toBe(true)
  })
})

describe('leaveRoom + post-leave guard', () => {
  it('transitions Active → Left and emits MemberLeft activity', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: false, enableSecondReviewer: false }))
    await requestJoin('room-1', makeRequest('u-1'))
    const result = await leaveRoom('room-1', 'u-1')
    expect(result.validation.valid).toBe(true)
    expect(result.member?.state).toBe(MembershipState.Left)
    expect(activityStore.some((e) => e.type === ActivityEventType.MemberLeft)).toBe(true)
  })

  it('blocks actions after leave (assertMemberCanAct)', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: false, enableSecondReviewer: false }))
    await requestJoin('room-1', makeRequest('u-1'))
    await leaveRoom('room-1', 'u-1')
    const guard = await assertMemberCanAct('room-1', 'u-1')
    expect(guard.valid).toBe(false)
    expect(guard.errors[0].code).toBe('invalid_transition')
  })

  it('blocks leave for a rejected member', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: true, enableSecondReviewer: false }))
    await requestJoin('room-1', makeRequest('u-1'))
    await denyJoin('room-1', 'u-1', { memberId: 'host', displayName: 'Host', role: RoomRole.Host })
    const result = await leaveRoom('room-1', 'u-1')
    expect(result.validation.valid).toBe(false)
  })
})

describe('applyMembershipMutation', () => {
  it('applies payload-provided member snapshot', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: true, enableSecondReviewer: false }))
    await requestJoin('room-1', makeRequest('u-1'))

    const result = await applyMembershipMutation('room-1', {
      operation: 'approve',
      memberId: 'u-1',
      member: {
        roomId: 'room-1',
        memberId: 'u-1',
        displayName: 'User-u-1',
        avatarColor: '#abcdef',
        role: RoomRole.Participant,
        state: MembershipState.Active,
        joinedAt: new Date().toISOString(),
        stateChangedAt: new Date().toISOString(),
        approvals: [],
      },
    })
    expect(result.valid).toBe(true)

    const updated = memberStore.get('room-1::u-1')
    expect(updated?.state).toBe(MembershipState.Active)
  })

  it('applies fallback state change when member snapshot is absent', async () => {
    roomStore.set('room-1', makeRoom({ requireApproval: true, enableSecondReviewer: false }))
    await requestJoin('room-1', makeRequest('u-2'))

    const result = await applyMembershipMutation('room-1', {
      operation: 'leave',
      memberId: 'u-2',
    })
    expect(result.valid).toBe(true)
    expect(memberStore.get('room-1::u-2')?.state).toBe(MembershipState.Left)
  })
})

// REQ: R1, R3, R4, R11 — Room model, roles, membership states
import { describe, it, expect } from 'vitest'
import {
  RoomRole,
  MembershipState,
  VALID_MEMBERSHIP_TRANSITIONS,
} from '@/models/room'

describe('RoomRole enum', () => {
  it('defines all four UI persona roles', () => {
    expect(RoomRole.Host).toBe('host')
    expect(RoomRole.Reviewer).toBe('reviewer')
    expect(RoomRole.Participant).toBe('participant')
    expect(RoomRole.Guest).toBe('guest')
  })

  it('has exactly 4 values', () => {
    const values = Object.values(RoomRole)
    expect(values).toHaveLength(4)
  })
})

describe('MembershipState enum', () => {
  it('defines all five states', () => {
    expect(MembershipState.Requested).toBe('requested')
    expect(MembershipState.PendingSecondApproval).toBe('pending_second_approval')
    expect(MembershipState.Active).toBe('active')
    expect(MembershipState.Left).toBe('left')
    expect(MembershipState.Rejected).toBe('rejected')
  })
})

describe('VALID_MEMBERSHIP_TRANSITIONS', () => {
  it('allows requested → active (direct approval)', () => {
    expect(VALID_MEMBERSHIP_TRANSITIONS[MembershipState.Requested]).toContain(MembershipState.Active)
  })

  it('allows requested → pending_second_approval', () => {
    expect(VALID_MEMBERSHIP_TRANSITIONS[MembershipState.Requested]).toContain(MembershipState.PendingSecondApproval)
  })

  it('allows requested → rejected', () => {
    expect(VALID_MEMBERSHIP_TRANSITIONS[MembershipState.Requested]).toContain(MembershipState.Rejected)
  })

  it('allows pending_second_approval → active', () => {
    expect(VALID_MEMBERSHIP_TRANSITIONS[MembershipState.PendingSecondApproval]).toContain(MembershipState.Active)
  })

  it('allows pending_second_approval → rejected', () => {
    expect(VALID_MEMBERSHIP_TRANSITIONS[MembershipState.PendingSecondApproval]).toContain(MembershipState.Rejected)
  })

  it('allows active → left', () => {
    expect(VALID_MEMBERSHIP_TRANSITIONS[MembershipState.Active]).toContain(MembershipState.Left)
  })

  it('does not allow left → anything (terminal)', () => {
    expect(VALID_MEMBERSHIP_TRANSITIONS[MembershipState.Left]).toHaveLength(0)
  })

  it('does not allow rejected → anything (terminal)', () => {
    expect(VALID_MEMBERSHIP_TRANSITIONS[MembershipState.Rejected]).toHaveLength(0)
  })

  it('does not allow active → requested (backwards)', () => {
    expect(VALID_MEMBERSHIP_TRANSITIONS[MembershipState.Active]).not.toContain(MembershipState.Requested)
  })

  it('covers all states as keys', () => {
    const allStates = Object.values(MembershipState)
    for (const state of allStates) {
      expect(VALID_MEMBERSHIP_TRANSITIONS).toHaveProperty(state)
    }
  })
})

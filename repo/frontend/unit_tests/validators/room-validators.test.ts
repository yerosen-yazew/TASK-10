// REQ: R1 — Max 20 members, R3 — state transitions, R4 — second Reviewer at 15+
import { describe, it, expect } from 'vitest'
import {
  validateMemberCount,
  validateMembershipTransition,
  requiresSecondApproval,
  validateMemberCanAct,
  validateDistinctApprovers,
} from '@/validators/room-validators'
import { MembershipState } from '@/models/room'
import { MAX_ROOM_MEMBERS, SECOND_REVIEWER_THRESHOLD } from '@/models/constants'

describe('validateMemberCount', () => {
  it('passes when under the limit', () => {
    const result = validateMemberCount(10)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('passes at one below the limit', () => {
    const result = validateMemberCount(MAX_ROOM_MEMBERS - 1)
    expect(result.valid).toBe(true)
  })

  it('fails at exactly the limit', () => {
    const result = validateMemberCount(MAX_ROOM_MEMBERS)
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('max_count')
  })

  it('fails above the limit', () => {
    const result = validateMemberCount(25)
    expect(result.valid).toBe(false)
  })

  it('passes at zero', () => {
    const result = validateMemberCount(0)
    expect(result.valid).toBe(true)
  })
})

describe('validateMembershipTransition', () => {
  it('allows requested → active', () => {
    const result = validateMembershipTransition(MembershipState.Requested, MembershipState.Active)
    expect(result.valid).toBe(true)
  })

  it('allows requested → pending_second_approval', () => {
    const result = validateMembershipTransition(MembershipState.Requested, MembershipState.PendingSecondApproval)
    expect(result.valid).toBe(true)
  })

  it('allows requested → rejected', () => {
    const result = validateMembershipTransition(MembershipState.Requested, MembershipState.Rejected)
    expect(result.valid).toBe(true)
  })

  it('allows pending_second_approval → active', () => {
    const result = validateMembershipTransition(MembershipState.PendingSecondApproval, MembershipState.Active)
    expect(result.valid).toBe(true)
  })

  it('allows active → left', () => {
    const result = validateMembershipTransition(MembershipState.Active, MembershipState.Left)
    expect(result.valid).toBe(true)
  })

  it('rejects left → active', () => {
    const result = validateMembershipTransition(MembershipState.Left, MembershipState.Active)
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('invalid_transition')
  })

  it('rejects left → requested', () => {
    const result = validateMembershipTransition(MembershipState.Left, MembershipState.Requested)
    expect(result.valid).toBe(false)
  })

  it('rejects rejected → active', () => {
    const result = validateMembershipTransition(MembershipState.Rejected, MembershipState.Active)
    expect(result.valid).toBe(false)
  })

  it('rejects active → requested (backwards)', () => {
    const result = validateMembershipTransition(MembershipState.Active, MembershipState.Requested)
    expect(result.valid).toBe(false)
  })

  it('rejects active → active (self)', () => {
    const result = validateMembershipTransition(MembershipState.Active, MembershipState.Active)
    expect(result.valid).toBe(false)
  })
})

describe('requiresSecondApproval', () => {
  it('returns false when second reviewer is disabled', () => {
    expect(requiresSecondApproval(16, false)).toBe(false)
  })

  it('returns false when below threshold with second reviewer enabled', () => {
    expect(requiresSecondApproval(14, true)).toBe(false)
  })

  it('returns true at exactly the threshold with second reviewer enabled', () => {
    expect(requiresSecondApproval(SECOND_REVIEWER_THRESHOLD, true)).toBe(true)
  })

  it('returns true above the threshold with second reviewer enabled', () => {
    expect(requiresSecondApproval(18, true)).toBe(true)
  })
})

describe('validateMemberCanAct', () => {
  it('allows active members to act', () => {
    const result = validateMemberCanAct(MembershipState.Active)
    expect(result.valid).toBe(true)
  })

  it('blocks left members from acting', () => {
    const result = validateMemberCanAct(MembershipState.Left)
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('invalid_transition')
  })

  it('blocks rejected members from acting', () => {
    const result = validateMemberCanAct(MembershipState.Rejected)
    expect(result.valid).toBe(false)
  })

  it('blocks requested members from acting', () => {
    const result = validateMemberCanAct(MembershipState.Requested)
    expect(result.valid).toBe(false)
  })

  it('blocks pending_second_approval members from acting', () => {
    const result = validateMemberCanAct(MembershipState.PendingSecondApproval)
    expect(result.valid).toBe(false)
  })
})

describe('validateDistinctApprovers', () => {
  it('passes with different approvers', () => {
    const result = validateDistinctApprovers('approver-1', 'approver-2')
    expect(result.valid).toBe(true)
  })

  it('fails with same approver', () => {
    const result = validateDistinctApprovers('approver-1', 'approver-1')
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('duplicate')
  })
})

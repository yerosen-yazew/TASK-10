// REQ: R1 — Max 20 active members (Host + up to 19)
// REQ: R3 — Configurable request→approval→active→leave flow
// REQ: R4 — Optional second Reviewer approval at 15+
// REQ: R10 — Membership activity emission (join/leave/approve/reject)
// REQ: Approval audit metadata (who approved, when, first or second)

import type { MemberRecord, RoomRole, JoinRequest, ApprovalRecord, Room } from '@/models/room'
import { MembershipState } from '@/models/room'
import type { ValidationResult } from '@/models/validation'
import { validResult, invalidResult, mergeResults } from '@/models/validation'
import {
  validateMemberCount,
  validateMembershipTransition,
  validateMemberCanAct,
  validateDistinctApprovers,
  requiresSecondApproval,
} from '@/validators/room-validators'
import { memberRepository } from '@/services/member-repository'
import { roomRepository } from '@/services/room-repository'
import { nowISO } from '@/utils/date-utils'
import { emitActivity, type ActivityActor } from './activity-engine'
import { ActivityEventType } from '@/models/activity'
import type { ApprovalOpPayload } from '@/models/collaboration'

/** Information about the party performing an approval decision. */
export interface ApprovalActor extends ActivityActor {
  role: RoomRole
}

/** Result of a membership mutation. */
export interface MembershipResult {
  validation: ValidationResult
  member?: MemberRecord
}

/** Submit a join request. Creates a MemberRecord in the Requested state. */
export async function requestJoin(
  roomId: string,
  request: JoinRequest
): Promise<MembershipResult> {
  const room = await roomRepository.getById(roomId)
  if (!room) {
    return {
      validation: invalidResult('roomId', 'Room not found.', 'not_found', roomId),
    }
  }

  // Prevent duplicate requests from the same requester (unless previously rejected/left).
  const existing = await memberRepository.find(roomId, request.requesterId)
  if (
    existing &&
    existing.state !== MembershipState.Rejected &&
    existing.state !== MembershipState.Left
  ) {
    return {
      validation: invalidResult(
        'memberId',
        'An active join request or membership already exists for this profile.',
        'duplicate',
        request.requesterId
      ),
    }
  }

  // If the room doesn't require approval, auto-approve.
  const skipApproval = !room.settings.requireApproval
  const now = nowISO()

  let initialState: MembershipState
  if (skipApproval) {
    const cap = validateMemberCount(await memberRepository.countActiveByRoom(roomId))
    if (!cap.valid) return { validation: cap }
    initialState = MembershipState.Active
  } else {
    initialState = MembershipState.Requested
  }

  const member: MemberRecord = {
    roomId,
    memberId: request.requesterId,
    displayName: request.displayName,
    avatarColor: request.avatarColor,
    role: request.requestedRole,
    state: initialState,
    joinedAt: request.requestedAt ?? now,
    stateChangedAt: now,
    approvals: [],
  }
  await memberRepository.put(member)

  if (initialState === MembershipState.Active) {
    await emitActivity(
      roomId,
      ActivityEventType.MemberJoined,
      { memberId: member.memberId, displayName: member.displayName },
      `${member.displayName} joined the room`,
      { targetId: member.memberId, targetType: 'member' }
    )
  }

  return { validation: validResult(), member }
}

/** Approve a join request. Handles single + dual-reviewer flow at 15+ members. */
export async function approveJoin(
  roomId: string,
  memberId: string,
  approver: ApprovalActor
): Promise<MembershipResult> {
  const [room, member] = await Promise.all([
    roomRepository.getById(roomId),
    memberRepository.find(roomId, memberId),
  ])
  if (!room) return { validation: invalidResult('roomId', 'Room not found.', 'not_found', roomId) }
  if (!member) return { validation: invalidResult('memberId', 'Member not found.', 'not_found', memberId) }

  const activeCount = await memberRepository.countActiveByRoom(roomId)
  const needsSecond = requiresSecondApproval(activeCount, room.settings.enableSecondReviewer)

  // Decide the next state.
  let nextState: MembershipState
  let isSecondApproval = false
  if (member.state === MembershipState.Requested) {
    nextState = needsSecond ? MembershipState.PendingSecondApproval : MembershipState.Active
  } else if (member.state === MembershipState.PendingSecondApproval) {
    nextState = MembershipState.Active
    isSecondApproval = true
  } else {
    return {
      validation: invalidResult(
        'membershipState',
        `Cannot approve a member in state "${member.state}".`,
        'invalid_transition',
        member.state
      ),
    }
  }

  // Validate the transition against the state machine.
  const transition = validateMembershipTransition(member.state, nextState)
  if (!transition.valid) return { validation: transition }

  // Validate distinct approvers on the second approval step.
  if (isSecondApproval) {
    const firstApprover = member.approvals.find(
      (a) => a.action === 'approve' && !a.isSecondApproval
    )
    if (firstApprover) {
      const distinct = validateDistinctApprovers(firstApprover.approverId, approver.memberId)
      if (!distinct.valid) return { validation: distinct }
    }
  }

  // When flipping to Active, re-check the 20-member cap so we never blow past it.
  if (nextState === MembershipState.Active) {
    const capCheck = validateMemberCount(activeCount)
    if (!capCheck.valid) return { validation: capCheck }
  }

  const now = nowISO()
  const approvalRecord: ApprovalRecord = {
    approverId: approver.memberId,
    approverDisplayName: approver.displayName,
    approverRole: approver.role,
    action: 'approve',
    timestamp: now,
    isSecondApproval,
  }
  const updated: MemberRecord = {
    ...member,
    state: nextState,
    stateChangedAt: now,
    approvals: [...member.approvals, approvalRecord],
  }
  await memberRepository.put(updated)

  await emitActivity(
    roomId,
    ActivityEventType.MemberApproved,
    approver,
    `${approver.displayName} approved ${member.displayName}${isSecondApproval ? ' (second approval)' : ''}`,
    { targetId: member.memberId, targetType: 'member' },
    { isSecondApproval, approverRole: approver.role }
  )
  if (nextState === MembershipState.Active) {
    await emitActivity(
      roomId,
      ActivityEventType.MemberJoined,
      { memberId: member.memberId, displayName: member.displayName },
      `${member.displayName} joined the room`,
      { targetId: member.memberId, targetType: 'member' }
    )
  }

  return { validation: validResult(), member: updated }
}

/** Deny a join request (terminal rejection). */
export async function denyJoin(
  roomId: string,
  memberId: string,
  approver: ApprovalActor,
  reason?: string
): Promise<MembershipResult> {
  const member = await memberRepository.find(roomId, memberId)
  if (!member) return { validation: invalidResult('memberId', 'Member not found.', 'not_found', memberId) }

  const transition = validateMembershipTransition(member.state, MembershipState.Rejected)
  if (!transition.valid) return { validation: transition }

  const now = nowISO()
  const approvalRecord: ApprovalRecord = {
    approverId: approver.memberId,
    approverDisplayName: approver.displayName,
    approverRole: approver.role,
    action: 'reject',
    timestamp: now,
    isSecondApproval: member.state === MembershipState.PendingSecondApproval,
  }
  const updated: MemberRecord = {
    ...member,
    state: MembershipState.Rejected,
    stateChangedAt: now,
    approvals: [...member.approvals, approvalRecord],
  }
  await memberRepository.put(updated)

  await emitActivity(
    roomId,
    ActivityEventType.MemberRejected,
    approver,
    `${approver.displayName} rejected ${member.displayName}${reason ? ` — ${reason}` : ''}`,
    { targetId: member.memberId, targetType: 'member' },
    { reason }
  )

  return { validation: validResult(), member: updated }
}

/** Mark a member as Left. */
export async function leaveRoom(roomId: string, memberId: string): Promise<MembershipResult> {
  const member = await memberRepository.find(roomId, memberId)
  if (!member) return { validation: invalidResult('memberId', 'Member not found.', 'not_found', memberId) }

  const transition = validateMembershipTransition(member.state, MembershipState.Left)
  if (!transition.valid) return { validation: transition }

  const now = nowISO()
  const updated: MemberRecord = {
    ...member,
    state: MembershipState.Left,
    stateChangedAt: now,
  }
  await memberRepository.put(updated)

  await emitActivity(
    roomId,
    ActivityEventType.MemberLeft,
    { memberId: member.memberId, displayName: member.displayName },
    `${member.displayName} left the room`,
    { targetId: member.memberId, targetType: 'member' }
  )

  return { validation: validResult(), member: updated }
}

/**
 * Guard helper: verify a member is allowed to perform room actions right now.
 * Returns a ValidationResult — callers must check `.valid` before proceeding.
 */
export async function assertMemberCanAct(
  roomId: string,
  memberId: string
): Promise<ValidationResult> {
  const member = await memberRepository.find(roomId, memberId)
  if (!member) {
    return invalidResult('memberId', 'Member not found.', 'not_found', memberId)
  }
  return mergeResults(validateMemberCanAct(member.state))
}

/** Re-export the room context used by callers. */
export type { Room }

/**
 * Apply an inbound WebRTC membership mutation payload to local IndexedDB.
 * This path intentionally avoids generating local activity records.
 */
export async function applyMembershipMutation(
  roomId: string,
  payload: ApprovalOpPayload
): Promise<ValidationResult> {
  if (!payload.memberId) {
    return invalidResult('memberId', 'Missing member id in collaboration payload.', 'required')
  }

  if (payload.member) {
    if (payload.member.roomId !== roomId) {
      return invalidResult('roomId', 'Membership payload room mismatch.', 'invalid')
    }
    if (payload.member.memberId !== payload.memberId) {
      return invalidResult('memberId', 'Membership payload id mismatch.', 'invalid')
    }
    await memberRepository.put(payload.member)
    return validResult()
  }

  const existing = await memberRepository.find(roomId, payload.memberId)
  if (!existing) {
    return invalidResult('memberId', 'Member not found for mutation.', 'not_found')
  }

  const stateByOperation: Record<ApprovalOpPayload['operation'], MembershipState> = {
    request: MembershipState.Requested,
    approve: MembershipState.Active,
    reject: MembershipState.Rejected,
    leave: MembershipState.Left,
  }
  const nextState = stateByOperation[payload.operation]

  await memberRepository.put({
    ...existing,
    state: nextState,
    stateChangedAt: nowISO(),
  })

  return validResult()
}

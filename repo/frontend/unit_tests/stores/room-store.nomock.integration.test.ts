import { beforeEach, describe, expect, it } from 'vitest'
import { useRoomStore } from '@/stores/room-store'
import { setupNoMockTestEnv, seedActiveHostRoom, seedActiveSessionProfile } from '../integration/no-mock-test-harness'
import { memberRepository } from '@/services/member-repository'
import { MembershipState, RoomRole, type MemberRecord } from '@/models/room'

function makeActor(memberId: string, displayName = 'Host Actor') {
  return {
    memberId,
    displayName,
    role: RoomRole.Host,
  }
}

describe('room-store no-mock integration', () => {
  beforeEach(async () => {
    await setupNoMockTestEnv()
  })

  it('loads active room and members from repositories', async () => {
    const { room } = await seedActiveHostRoom({ name: 'Load Room' })
    const store = useRoomStore()

    await store.loadRoom(room.roomId)

    expect(store.activeRoom?.roomId).toBe(room.roomId)
    expect(store.members.length).toBe(1)
    expect(store.lastError).toBeNull()
  })

  it('sets activeRoom null when loading unknown room id', async () => {
    await seedActiveHostRoom()
    const store = useRoomStore()

    await store.loadRoom('missing-room')

    expect(store.activeRoom).toBeNull()
  })

  it('creates a room with a valid payload', async () => {
    const host = await seedActiveSessionProfile({ displayName: 'Creator Host' })
    const store = useRoomStore()

    const result = await store.createRoom({
      name: 'Created by Store',
      description: 'Store no-mock create room',
      hostProfileId: host.profileId,
      hostDisplayName: host.displayName,
      hostAvatarColor: host.avatarColor,
      settings: { requireApproval: false, enableSecondReviewer: false },
    })

    expect(result.validation.valid).toBe(true)
    expect(store.activeRoom?.name).toBe('Created by Store')
    expect(store.members[0].state).toBe(MembershipState.Active)
  })

  it('rejects room creation with an invalid name', async () => {
    const host = await seedActiveSessionProfile({ displayName: 'Invalid Name Host' })
    const store = useRoomStore()

    const result = await store.createRoom({
      name: ' ',
      description: 'invalid room name',
      hostProfileId: host.profileId,
      hostDisplayName: host.displayName,
      hostAvatarColor: host.avatarColor,
      settings: { requireApproval: false, enableSecondReviewer: false },
    })

    expect(result.validation.valid).toBe(false)
    expect(result.room).toBeUndefined()
  })

  it('requestJoin creates requested member when approval is required', async () => {
    const { room } = await seedActiveHostRoom({ requireApproval: true })
    const joiner = await seedActiveSessionProfile({ displayName: 'Requested Joiner' })
    const store = useRoomStore()

    await store.loadRoom(room.roomId)

    const result = await store.requestJoin({
      roomId: room.roomId,
      requesterId: joiner.profileId,
      displayName: joiner.displayName,
      avatarColor: joiner.avatarColor,
      requestedRole: RoomRole.Participant,
      requestedAt: new Date().toISOString(),
      pairingCode: room.pairingCode,
    })

    expect(result.validation.valid).toBe(true)
    expect(result.member?.state).toBe(MembershipState.Requested)
    expect(store.pendingMembers.length).toBeGreaterThan(0)
  })

  it('approveJoin transitions member from requested to active', async () => {
    const { room, host } = await seedActiveHostRoom({ requireApproval: true })
    const joiner = await seedActiveSessionProfile({ displayName: 'Approvable Joiner' })
    const store = useRoomStore()

    await store.loadRoom(room.roomId)
    await store.requestJoin({
      roomId: room.roomId,
      requesterId: joiner.profileId,
      displayName: joiner.displayName,
      avatarColor: joiner.avatarColor,
      requestedRole: RoomRole.Participant,
      requestedAt: new Date().toISOString(),
      pairingCode: room.pairingCode,
    })

    const approve = await store.approveJoin(joiner.profileId, makeActor(host.profileId, host.displayName))

    expect(approve.validation.valid).toBe(true)
    const member = await memberRepository.find(room.roomId, joiner.profileId)
    expect(member?.state).toBe(MembershipState.Active)
  })

  it('denyJoin transitions requested member to rejected', async () => {
    const { room, host } = await seedActiveHostRoom({ requireApproval: true })
    const joiner = await seedActiveSessionProfile({ displayName: 'Rejectable Joiner' })
    const store = useRoomStore()

    await store.loadRoom(room.roomId)
    await store.requestJoin({
      roomId: room.roomId,
      requesterId: joiner.profileId,
      displayName: joiner.displayName,
      avatarColor: joiner.avatarColor,
      requestedRole: RoomRole.Participant,
      requestedAt: new Date().toISOString(),
      pairingCode: room.pairingCode,
    })

    const deny = await store.denyJoin(joiner.profileId, makeActor(host.profileId, host.displayName), 'Not now')

    expect(deny.validation.valid).toBe(true)
    const member = await memberRepository.find(room.roomId, joiner.profileId)
    expect(member?.state).toBe(MembershipState.Rejected)
  })

  it('leave transitions active member to left', async () => {
    const { room, host } = await seedActiveHostRoom({ requireApproval: false })
    const joiner = await seedActiveSessionProfile({ displayName: 'Leaver' })
    const store = useRoomStore()

    await store.loadRoom(room.roomId)
    await store.requestJoin({
      roomId: room.roomId,
      requesterId: joiner.profileId,
      displayName: joiner.displayName,
      avatarColor: joiner.avatarColor,
      requestedRole: RoomRole.Participant,
      requestedAt: new Date().toISOString(),
      pairingCode: room.pairingCode,
    })

    const leave = await store.leave(joiner.profileId)

    expect(leave.validation.valid).toBe(true)
    const member = await memberRepository.find(room.roomId, joiner.profileId)
    expect(member?.state).toBe(MembershipState.Left)

    const hostMember = await memberRepository.find(room.roomId, host.profileId)
    expect(hostMember?.state).toBe(MembershipState.Active)
  })

  it('throws when approving without an active room loaded', async () => {
    await seedActiveHostRoom()
    const store = useRoomStore()

    await expect(store.approveJoin('missing-member', makeActor('host-1'))).rejects.toThrow('No active room.')
  })

  it('refreshMembers reflects externally inserted active members', async () => {
    const { room } = await seedActiveHostRoom({ requireApproval: true })
    const store = useRoomStore()

    await store.loadRoom(room.roomId)

    const externalMember: MemberRecord = {
      roomId: room.roomId,
      memberId: 'external-member',
      displayName: 'External Member',
      avatarColor: '#22c55e',
      role: RoomRole.Participant,
      state: MembershipState.Active,
      joinedAt: new Date().toISOString(),
      stateChangedAt: new Date().toISOString(),
      approvals: [],
    }
    await memberRepository.put(externalMember)

    await store.refreshMembers()

    expect(store.activeMembers.some((m) => m.memberId === externalMember.memberId)).toBe(true)
  })

  it('pendingMembers includes requested and pending-second states only', async () => {
    const { room } = await seedActiveHostRoom({ requireApproval: true })
    const store = useRoomStore()
    await store.loadRoom(room.roomId)

    await memberRepository.put({
      roomId: room.roomId,
      memberId: 'requested-one',
      displayName: 'Requested One',
      avatarColor: '#f97316',
      role: RoomRole.Participant,
      state: MembershipState.Requested,
      joinedAt: new Date().toISOString(),
      stateChangedAt: new Date().toISOString(),
      approvals: [],
    })

    await memberRepository.put({
      roomId: room.roomId,
      memberId: 'pending-two',
      displayName: 'Pending Two',
      avatarColor: '#7c3aed',
      role: RoomRole.Participant,
      state: MembershipState.PendingSecondApproval,
      joinedAt: new Date().toISOString(),
      stateChangedAt: new Date().toISOString(),
      approvals: [],
    })

    await memberRepository.put({
      roomId: room.roomId,
      memberId: 'active-three',
      displayName: 'Active Three',
      avatarColor: '#2563eb',
      role: RoomRole.Participant,
      state: MembershipState.Active,
      joinedAt: new Date().toISOString(),
      stateChangedAt: new Date().toISOString(),
      approvals: [],
    })

    await store.refreshMembers()

    expect(store.pendingMembers.map((m) => m.memberId).sort()).toEqual(['pending-two', 'requested-one'])
  })

  it('prevents duplicate join requests for same member profile', async () => {
    const { room } = await seedActiveHostRoom({ requireApproval: true })
    const joiner = await seedActiveSessionProfile({ displayName: 'Duplicate Joiner' })
    const store = useRoomStore()

    await store.loadRoom(room.roomId)

    const first = await store.requestJoin({
      roomId: room.roomId,
      requesterId: joiner.profileId,
      displayName: joiner.displayName,
      avatarColor: joiner.avatarColor,
      requestedRole: RoomRole.Participant,
      requestedAt: new Date().toISOString(),
      pairingCode: room.pairingCode,
    })

    const second = await store.requestJoin({
      roomId: room.roomId,
      requesterId: joiner.profileId,
      displayName: joiner.displayName,
      avatarColor: joiner.avatarColor,
      requestedRole: RoomRole.Participant,
      requestedAt: new Date().toISOString(),
      pairingCode: room.pairingCode,
    })

    expect(first.validation.valid).toBe(true)
    expect(second.validation.valid).toBe(false)
    expect(second.validation.errors[0]?.code).toBe('duplicate')
  })
})

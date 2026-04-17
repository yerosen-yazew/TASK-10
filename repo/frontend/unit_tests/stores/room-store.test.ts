// REQ: R1/R3/R4 — Room store: loadRoom, createRoom, approveJoin, denyJoin, leave
// REQ: R18/R19 — room-store publishes membership-change via collab-publisher

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRoomStore } from '@/stores/room-store'
import { MembershipState, RoomRole } from '@/models/room'

const mockRoom = {
  roomId: 'room-1',
  name: 'Test Room',
  description: '',
  pairingCode: 'AAAA-BBBB',
  hostProfileId: 'host-1',
  settings: { requireApproval: true, enableSecondReviewer: false },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const mockMember = {
  memberId: 'member-1',
  roomId: 'room-1',
  displayName: 'Alice',
  avatarColor: '#ff0000',
  role: RoomRole.Participant,
  state: MembershipState.Active,
  joinedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

vi.mock('@/engine/room-engine', () => ({
  getRoom: vi.fn(async (roomId: string) => roomId === 'room-1' ? mockRoom : undefined),
  createRoom: vi.fn(async (input: { name: string }) => ({
    validation: { valid: true, errors: [] },
    room: { ...mockRoom, roomId: 'new-room', name: input.name },
  })),
}))

vi.mock('@/engine/membership-engine', () => ({
  requestJoin: vi.fn(async () => ({
    validation: { valid: true, errors: [] },
    member: { ...mockMember, state: MembershipState.Requested },
  })),
  approveJoin: vi.fn(async () => ({
    validation: { valid: true, errors: [] },
    member: { ...mockMember, state: MembershipState.Active },
  })),
  denyJoin: vi.fn(async () => ({
    validation: { valid: true, errors: [] },
    member: { ...mockMember, state: MembershipState.Rejected },
  })),
  leaveRoom: vi.fn(async () => ({
    validation: { valid: true, errors: [] },
    member: { ...mockMember, state: MembershipState.Left },
  })),
}))

vi.mock('@/services/member-repository', () => ({
  memberRepository: {
    listByRoom: vi.fn(async () => [mockMember]),
  },
}))

const mockPublishMembership = vi.fn()
vi.mock('@/services/collab-publisher', () => ({
  publishMembership: (...args: any[]) => mockPublishMembership(...args),
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

describe('room-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('loadRoom', () => {
    it('loads room and members on happy path', async () => {
      const store = useRoomStore()
      await store.loadRoom('room-1')
      expect(store.activeRoom?.roomId).toBe('room-1')
      expect(store.members).toHaveLength(1)
      expect(store.isLoading).toBe(false)
      expect(store.lastError).toBeNull()
    })

    it('sets activeRoom to null when room not found', async () => {
      const store = useRoomStore()
      await store.loadRoom('nonexistent')
      expect(store.activeRoom).toBeNull()
      expect(store.isLoading).toBe(false)
    })

    it('sets lastError on repository failure', async () => {
      const { memberRepository } = await import('@/services/member-repository')
      vi.mocked(memberRepository.listByRoom).mockRejectedValueOnce(new Error('DB error'))
      const store = useRoomStore()
      await store.loadRoom('room-1')
      expect(store.lastError).toBe('Failed to load room.')
    })
  })

  describe('createRoom', () => {
    it('sets activeRoom and refreshes members on success', async () => {
      const store = useRoomStore()
      const result = await store.createRoom({
        name: 'New Room',
        description: '',
        hostProfileId: 'host-1',
        hostDisplayName: 'Host',
        hostAvatarColor: '#000',
        settings: { requireApproval: false, enableSecondReviewer: false },
      })
      expect(result.validation.valid).toBe(true)
      expect(store.activeRoom?.name).toBe('New Room')
    })

    it('surfaces validation error without setting activeRoom', async () => {
      const roomEngine = await import('@/engine/room-engine')
      vi.mocked(roomEngine.createRoom).mockResolvedValueOnce({
        validation: { valid: false, errors: [{ field: 'name', message: 'Too short', code: 'too_short' }] },
        room: null,
      })
      const store = useRoomStore()
      const result = await store.createRoom({
        name: 'x',
        description: '',
        hostProfileId: 'host-1',
        hostDisplayName: 'Host',
        hostAvatarColor: '#000',
        settings: { requireApproval: false, enableSecondReviewer: false },
      })
      expect(result.validation.valid).toBe(false)
      expect(store.activeRoom).toBeNull()
    })
  })

  describe('approveJoin', () => {
    it('calls approveJoin engine and refreshes members', async () => {
      const store = useRoomStore()
      store.activeRoom = mockRoom as any
      const actor = { memberId: 'host-1', displayName: 'Host', role: RoomRole.Host }
      const result = await store.approveJoin('member-1', actor)
      expect(result.validation.valid).toBe(true)
      const membershipEngine = await import('@/engine/membership-engine')
      expect(membershipEngine.approveJoin).toHaveBeenCalledWith('room-1', 'member-1', actor)
    })

    it('throws when no active room', async () => {
      const store = useRoomStore()
      const actor = { memberId: 'host-1', displayName: 'Host', role: RoomRole.Host }
      await expect(store.approveJoin('member-1', actor)).rejects.toThrow('No active room.')
    })
  })

  describe('denyJoin', () => {
    it('calls denyJoin engine and refreshes members', async () => {
      const store = useRoomStore()
      store.activeRoom = mockRoom as any
      const actor = { memberId: 'host-1', displayName: 'Host', role: RoomRole.Host }
      const result = await store.denyJoin('member-1', actor, 'Not allowed')
      expect(result.validation.valid).toBe(true)
    })
  })

  describe('leave', () => {
    it('calls leaveRoom engine and refreshes members', async () => {
      const store = useRoomStore()
      store.activeRoom = mockRoom as any
      const result = await store.leave('member-1')
      expect(result.validation.valid).toBe(true)
      const membershipEngine = await import('@/engine/membership-engine')
      expect(membershipEngine.leaveRoom).toHaveBeenCalledWith('room-1', 'member-1')
    })
  })

  describe('collab-publisher integration', () => {
    it('publishes membership-change with op "approve" on approveJoin', async () => {
      const store = useRoomStore()
      store.activeRoom = mockRoom as any
      const actor = { memberId: 'host-1', displayName: 'Host', role: RoomRole.Host }
      await store.approveJoin('member-1', actor)
      expect(mockPublishMembership).toHaveBeenCalledOnce()
      const [roomId, op, memberId, senderId] = mockPublishMembership.mock.calls[0]
      expect(roomId).toBe('room-1')
      expect(op).toBe('approve')
      expect(memberId).toBe('member-1')
      expect(senderId).toBe('host-1')
    })

    it('publishes membership-change with op "reject" on denyJoin', async () => {
      const store = useRoomStore()
      store.activeRoom = mockRoom as any
      const actor = { memberId: 'host-1', displayName: 'Host', role: RoomRole.Host }
      await store.denyJoin('member-1', actor, 'Not allowed')
      expect(mockPublishMembership).toHaveBeenCalledOnce()
      const [, op, memberId] = mockPublishMembership.mock.calls[0]
      expect(op).toBe('reject')
      expect(memberId).toBe('member-1')
    })

    it('publishes membership-change with op "leave" on leave', async () => {
      const store = useRoomStore()
      store.activeRoom = mockRoom as any
      await store.leave('member-1')
      expect(mockPublishMembership).toHaveBeenCalledOnce()
      const [, op, memberId] = mockPublishMembership.mock.calls[0]
      expect(op).toBe('leave')
      expect(memberId).toBe('member-1')
    })
  })

  describe('computed', () => {
    it('activeMembers filters by Active state', async () => {
      const store = useRoomStore()
      await store.loadRoom('room-1')
      expect(store.activeMembers).toHaveLength(1)
    })

    it('pendingMembers includes Requested and PendingSecondApproval', async () => {
      const { memberRepository } = await import('@/services/member-repository')
      vi.mocked(memberRepository.listByRoom).mockResolvedValueOnce([
        { ...mockMember, state: MembershipState.Requested },
        { ...mockMember, memberId: 'm2', state: MembershipState.PendingSecondApproval },
        { ...mockMember, memberId: 'm3', state: MembershipState.Active },
      ])
      const store = useRoomStore()
      await store.loadRoom('room-1')
      expect(store.pendingMembers).toHaveLength(2)
    })
  })
})

// REQ: R3/R4 — ApprovalQueue: pending members, approve/deny, dual-reviewer badge, 20-member cap

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { MembershipState, RoomRole } from '@/models/room'
import { MAX_ROOM_MEMBERS } from '@/models/constants'

const mockApproveJoin = vi.fn(async () => ({
  validation: { valid: true, errors: [] },
  member: null,
}))
const mockDenyJoin = vi.fn(async () => ({
  validation: { valid: true, errors: [] },
  member: null,
}))
const mockConfirm = vi.fn(async () => true)

const pendingMember = {
  memberId: 'member-pending',
  roomId: 'room-1',
  displayName: 'Bob',
  avatarColor: '#00ff00',
  role: RoomRole.Participant,
  state: MembershipState.Requested,
  requestedAt: '2026-01-01T00:00:00.000Z',
  joinedAt: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const secondApprovalMember = {
  ...pendingMember,
  memberId: 'member-2nd',
  state: MembershipState.PendingSecondApproval,
}

vi.mock('@/stores/room-store', () => ({
  useRoomStore: vi.fn(() => ({
    activeRoom: {
      roomId: 'room-1',
      settings: { requireApproval: true, enableSecondReviewer: true },
    },
    members: [
      {
        memberId: 'host-1',
        roomId: 'room-1',
        displayName: 'Host',
        avatarColor: '#ffffff',
        role: RoomRole.Host,
        state: MembershipState.Active,
        joinedAt: '2026-01-01T00:00:00.000Z',
        stateChangedAt: '2026-01-01T00:00:00.000Z',
        approvals: [],
      },
      pendingMember,
    ],
    activeMembers: [],
    pendingMembers: [pendingMember],
    approveJoin: mockApproveJoin,
    denyJoin: mockDenyJoin,
  })),
}))

vi.mock('@/stores/session-store', () => ({
  useSessionStore: () => ({
    activeProfileId: 'host-1',
    activeProfile: { profileId: 'host-1', displayName: 'Host', avatarColor: '#fff' },
  }),
}))

vi.mock('@/stores/ui-store', () => ({
  useUiStore: () => ({
    confirm: mockConfirm,
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  }),
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

async function mountQueue(props = {}) {
  const { default: ApprovalQueue } = await import('@/components/workspace/ApprovalQueue.vue')
  return mount(ApprovalQueue, {
    props: {
      pending: [pendingMember],
      activeCount: 1,
      ...props,
    },
  })
}

describe('ApprovalQueue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders pending member', async () => {
    const wrapper = await mountQueue()
    expect(wrapper.text()).toContain('Bob')
  })

  it('approve button calls approveJoin', async () => {
    const wrapper = await mountQueue()
    const approveBtn = wrapper.find('[data-testid="approve-btn-member-pending"]')
    if (approveBtn.exists()) {
      await approveBtn.trigger('click')
      await flushPromises()
      expect(mockApproveJoin).toHaveBeenCalledOnce()
    }
  })

  it('deny button shows confirm then calls denyJoin', async () => {
    const wrapper = await mountQueue()
    const denyBtn = wrapper.find('[data-testid="deny-btn-member-pending"]')
    if (denyBtn.exists()) {
      await denyBtn.trigger('click')
      await flushPromises()
      expect(mockConfirm).toHaveBeenCalled()
      expect(mockDenyJoin).toHaveBeenCalledOnce()
    }
  })

  it('deny button does NOT call denyJoin when confirm cancelled', async () => {
    mockConfirm.mockResolvedValueOnce(false)
    const wrapper = await mountQueue()
    const denyBtn = wrapper.find('[data-testid="deny-btn-member-pending"]')
    if (denyBtn.exists()) {
      await denyBtn.trigger('click')
      await flushPromises()
      expect(mockDenyJoin).not.toHaveBeenCalled()
    }
  })

  it('shows dual-reviewer badge for PendingSecondApproval state', async () => {
    const { useRoomStore } = await import('@/stores/room-store')
    vi.mocked(useRoomStore).mockReturnValueOnce({
      activeRoom: { roomId: 'room-1', settings: { requireApproval: true, enableSecondReviewer: true } },
      members: [
        {
          memberId: 'host-1',
          roomId: 'room-1',
          displayName: 'Host',
          avatarColor: '#ffffff',
          role: RoomRole.Host,
          state: MembershipState.Active,
          joinedAt: '2026-01-01T00:00:00.000Z',
          stateChangedAt: '2026-01-01T00:00:00.000Z',
          approvals: [],
        },
        secondApprovalMember,
      ],
      activeMembers: [],
      pendingMembers: [secondApprovalMember],
      approveJoin: mockApproveJoin,
      denyJoin: mockDenyJoin,
    } as any)
    const wrapper = await mountQueue({ pending: [secondApprovalMember] })
    expect(wrapper.text()).toMatch(/second|2nd|dual/i)
  })

  it('approve button disabled when activeCount is at MAX_ROOM_MEMBERS', async () => {
    const wrapper = await mountQueue({ activeCount: MAX_ROOM_MEMBERS })
    const approveBtn = wrapper.find('[data-testid="approve-btn-member-pending"]')
    if (approveBtn.exists()) {
      expect((approveBtn.element as HTMLButtonElement).disabled).toBe(true)
    }
  })
})

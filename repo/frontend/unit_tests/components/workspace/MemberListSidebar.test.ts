// REQ: R1/R3/R4 — Member list sidebar: grouped by state, approval queue Host/Reviewer only

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import MemberListSidebar from '@/components/workspace/MemberListSidebar.vue'
import { useRoomStore } from '@/stores/room-store'
import { useSessionStore } from '@/stores/session-store'
import { MembershipState, RoomRole } from '@/models/room'
import type { MemberRecord } from '@/models/room'

function makeMember(overrides: Partial<MemberRecord> = {}): MemberRecord {
  const now = new Date().toISOString()
  return {
    memberId: overrides.memberId ?? `m-${Math.random().toString(36).slice(2, 8)}`,
    roomId: 'room-1',
    displayName: 'Alice',
    role: RoomRole.Participant,
    state: MembershipState.Active,
    avatarColor: '#f87171',
    joinedAt: now,
    updatedAt: now,
    ...overrides,
  } as MemberRecord
}

describe('MemberListSidebar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows the loading spinner while roomStore is loading', () => {
    const wrapper = mount(MemberListSidebar)
    const room = useRoomStore()
    room.isLoading = true
    return wrapper.vm.$nextTick().then(() => {
      expect(wrapper.find('.loading-spinner').exists()).toBe(true)
    })
  })

  it('renders one row per active member with role and name', async () => {
    const wrapper = mount(MemberListSidebar)
    const room = useRoomStore()
    room.activeRoom = { roomId: 'room-1' } as any
    room.members = [
      makeMember({ memberId: 'a', displayName: 'Alice', role: RoomRole.Host }),
      makeMember({ memberId: 'b', displayName: 'Bob', role: RoomRole.Participant }),
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.member-list__item').length).toBe(2)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
    expect(wrapper.text().toLowerCase()).toContain('host')
  })

  it('renders a Past section when there are Left/Rejected members', async () => {
    const wrapper = mount(MemberListSidebar)
    const room = useRoomStore()
    room.activeRoom = { roomId: 'room-1' } as any
    room.members = [
      makeMember({ memberId: 'a', displayName: 'Alice', state: MembershipState.Active }),
      makeMember({ memberId: 'c', displayName: 'Carol', state: MembershipState.Left }),
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Past')
    expect(wrapper.findAll('.member-list__section').length).toBe(2)
  })

  it('hides the approval queue for non-host/reviewer roles even if pending exists', async () => {
    const wrapper = mount(MemberListSidebar)
    const room = useRoomStore()
    const session = useSessionStore()
    session.activeProfileId = 'me'
    room.activeRoom = { roomId: 'room-1' } as any
    room.members = [
      makeMember({ memberId: 'me', role: RoomRole.Participant }),
      makeMember({ memberId: 'p', state: MembershipState.Requested, displayName: 'Pending' }),
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.approval-queue').exists()).toBe(false)
  })

  it('renders the approval queue for hosts when pendingMembers exist', async () => {
    const wrapper = mount(MemberListSidebar)
    const room = useRoomStore()
    const session = useSessionStore()
    session.activeProfileId = 'host'
    room.activeRoom = { roomId: 'room-1' } as any
    room.members = [
      makeMember({ memberId: 'host', role: RoomRole.Host, state: MembershipState.Active }),
      makeMember({
        memberId: 'p1',
        state: MembershipState.Requested,
        displayName: 'Pending One',
      }),
    ]
    await wrapper.vm.$nextTick()
    // ApprovalQueue is mounted; its root class begins with 'approval-queue'
    expect(wrapper.find('.approval-queue, [class*=\"approval\"]').exists()).toBe(true)
  })

  it('shows no members section rows when members list is empty', async () => {
    const wrapper = mount(MemberListSidebar)
    const room = useRoomStore()
    room.activeRoom = { roomId: 'room-1' } as any
    room.members = []
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.member-list__item').length).toBe(0)
    expect(wrapper.text()).toContain('Active (0)')
  })
})

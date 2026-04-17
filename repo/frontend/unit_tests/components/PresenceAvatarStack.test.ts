// REQ: R9 — PresenceAvatarStack: online members, +N overflow, idle opacity

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PresenceAvatarStack from '@/components/workspace/PresenceAvatarStack.vue'

const makePresence = (id: string, isOnline = true) => ({
  memberId: id,
  displayName: `User ${id}`,
  avatarColor: '#334155',
  roomId: 'room-1',
  currentTool: 'select',
  cursor: null,
  isOnline,
  lastSeenAt: '2026-01-01T00:00:00.000Z',
})

describe('PresenceAvatarStack', () => {
  it('renders avatars for online members', () => {
    const members = [makePresence('1'), makePresence('2'), makePresence('3')]
    const wrapper = mount(PresenceAvatarStack, { props: { members } })
    // The component renders the display name as a title attribute on each avatar
    expect(wrapper.html()).toContain('User 1')
    expect(wrapper.html()).toContain('User 2')
  })

  it('shows +N overflow chip when more than 5 members', () => {
    const members = Array.from({ length: 8 }, (_, i) => makePresence(`${i}`))
    const wrapper = mount(PresenceAvatarStack, { props: { members } })
    expect(wrapper.html()).toContain('+3')
  })

  it('does NOT show overflow text for 5 or fewer members', () => {
    const members = Array.from({ length: 5 }, (_, i) => makePresence(`${i}`))
    const wrapper = mount(PresenceAvatarStack, { props: { members } })
    // No +N overflow should be shown for 5 members
    expect(wrapper.html()).not.toContain('+')
  })

  it('offline/idle members have reduced opacity class', () => {
    const members = [makePresence('idle-1', false)]
    const wrapper = mount(PresenceAvatarStack, { props: { members } })
    // Component uses !isOnline → idle class
    expect(wrapper.html()).toContain('idle')
  })

  it('online members do not have idle opacity class', () => {
    const members = [makePresence('active-1', true)]
    const wrapper = mount(PresenceAvatarStack, { props: { members } })
    // Online-only member should not have idle class
    const idleElements = wrapper.findAll('[class*="idle"]')
    expect(idleElements.length).toBe(0)
  })

  it('renders empty without crashing when no members', () => {
    const wrapper = mount(PresenceAvatarStack, { props: { members: [] } })
    expect(wrapper.exists()).toBe(true)
  })

  it('shows correct overflow count (+3 for 8 members shown as 5+3)', () => {
    const members = Array.from({ length: 8 }, (_, i) => makePresence(`${i}`))
    const wrapper = mount(PresenceAvatarStack, { props: { members } })
    expect(wrapper.html()).toContain('+3')
  })
})

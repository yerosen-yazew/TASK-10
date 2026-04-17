// REQ: R11 — AppLayout renders header, role chip (persona-only), lock button, toast+banner+modal

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import AppLayout from '@/layouts/AppLayout.vue'
import { useSessionStore } from '@/stores/session-store'
import { SessionState } from '@/models/profile'
import { RoomRole } from '@/models/room'

function mountLayout(props: Record<string, unknown> = {}, slot = '<div class="slot">content</div>') {
  return mount(AppLayout, {
    props,
    slots: { default: slot },
    global: { stubs: { 'router-link': RouterLinkStub } },
  })
}

describe('AppLayout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the slot content inside main', () => {
    const wrapper = mountLayout()
    expect(wrapper.find('main.app-main .slot').exists()).toBe(true)
  })

  it('always mounts AppBanner, ToastContainer, and ConfirmModal', () => {
    const wrapper = mountLayout()
    expect(wrapper.findComponent({ name: 'AppBanner' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ToastContainer' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ConfirmModal' }).exists()).toBe(true)
  })

  it('hides the profile/lock header right-side when session is not unlocked', () => {
    const wrapper = mountLayout()
    const session = useSessionStore()
    session.sessionState = SessionState.NoProfile
    expect(wrapper.find('.app-header__right').exists()).toBe(false)
  })

  it('shows the profile chip and lock button when session is unlocked', async () => {
    const wrapper = mountLayout()
    const session = useSessionStore()
    session.profiles = [
      { profileId: 'p1', displayName: 'Alice', avatarColor: '#abcdef' } as any,
    ]
    session.activeProfileId = 'p1'
    session.sessionState = SessionState.Active
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.app-header__right').exists()).toBe(true)
    expect(wrapper.find('.app-header__profile-name').text()).toBe('Alice')
    expect(wrapper.find('.app-header__lock-btn').exists()).toBe(true)
  })

  it('shows the role chip when a role prop is provided', async () => {
    const wrapper = mountLayout({ role: RoomRole.Host })
    const session = useSessionStore()
    session.profiles = [{ profileId: 'p1', displayName: 'A', avatarColor: '#fff' } as any]
    session.activeProfileId = 'p1'
    session.sessionState = SessionState.Active
    await wrapper.vm.$nextTick()
    const chip = wrapper.find('.app-header__role')
    expect(chip.exists()).toBe(true)
    expect(chip.text()).toBe('Host')
    expect(chip.attributes('title')?.toLowerCase()).toContain('ui personas')
  })

  it('clicking the lock button calls sessionStore.lock', async () => {
    const wrapper = mountLayout()
    const session = useSessionStore()
    session.profiles = [{ profileId: 'p1', displayName: 'A', avatarColor: '#fff' } as any]
    session.activeProfileId = 'p1'
    session.sessionState = SessionState.Active
    await wrapper.vm.$nextTick()
    const lockSpy = vi.spyOn(session, 'lock').mockImplementation(() => {})
    await wrapper.find('.app-header__lock-btn').trigger('click')
    expect(lockSpy).toHaveBeenCalled()
  })

  it('uses the active profile initial for the avatar', async () => {
    const wrapper = mountLayout()
    const session = useSessionStore()
    session.profiles = [
      { profileId: 'p1', displayName: 'Zoë', avatarColor: '#fff' } as any,
    ]
    session.activeProfileId = 'p1'
    session.sessionState = SessionState.Active
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.app-header__avatar').text()).toBe('Z')
  })
})

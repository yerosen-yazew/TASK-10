// REQ: R11/R12/R13 — Profile select page: list/unlock/create, passphrase validation, session messages

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ProfileSelectPage from '@/pages/ProfileSelectPage.vue'
import { useSessionStore } from '@/stores/session-store'
import { SessionState } from '@/models/profile'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ query: {} }),
}))

function mountPage() {
  return mount(ProfileSelectPage, {
    global: { stubs: { 'router-link': RouterLinkStub } },
  })
}

describe('ProfileSelectPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockReset()
  })

  it('shows the loading indicator while session store is loading', async () => {
    const wrapper = mountPage()
    const session = useSessionStore()
    session.isLoading = true
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Loading profiles…')
  })

  it('shows the empty state when no profiles exist', async () => {
    const wrapper = mountPage()
    const session = useSessionStore()
    session.isLoading = false
    session.profiles = []
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('No profiles yet')
  })

  it('renders one profile entry per stored profile', async () => {
    const wrapper = mountPage()
    const session = useSessionStore()
    session.isLoading = false
    session.profiles = [
      { profileId: 'p1', displayName: 'Alice', avatarColor: '#f00' } as any,
      { profileId: 'p2', displayName: 'Bob', avatarColor: '#0f0' } as any,
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.profile-list__item').length).toBe(2)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
  })

  it('surfaces the inactivity-lock notice when sessionState is InactivityLocked', async () => {
    const wrapper = mountPage()
    const session = useSessionStore()
    session.sessionState = SessionState.InactivityLocked
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.profile-card__session-notice').text()).toContain(
      '30 minutes of inactivity',
    )
  })

  it('surfaces the forced-sign-out notice after 8 hours', async () => {
    const wrapper = mountPage()
    const session = useSessionStore()
    session.sessionState = SessionState.ForcedSignOut
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.profile-card__session-notice').text()).toContain('8 hours')
  })

  it('switches to the unlock view when a profile is selected', async () => {
    const wrapper = mountPage()
    const session = useSessionStore()
    session.isLoading = false
    session.profiles = [
      { profileId: 'p1', displayName: 'Alice', avatarColor: '#f00' } as any,
    ]
    await wrapper.vm.$nextTick()
    await wrapper.find('.profile-list__button').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.unlock-form').exists()).toBe(true)
  })

  it('shows an inline validation error when unlock passphrase is too short', async () => {
    const wrapper = mountPage()
    const session = useSessionStore()
    session.isLoading = false
    session.profiles = [{ profileId: 'p1', displayName: 'Alice', avatarColor: '#f00' } as any]
    await wrapper.vm.$nextTick()
    await wrapper.find('.profile-list__button').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('#unlock-passphrase').setValue('short')
    await wrapper.find('.unlock-form').trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.text().toLowerCase()).toMatch(/passphrase|8/)
  })

  it('disables the submit button while session is submitting', async () => {
    const wrapper = mountPage()
    const session = useSessionStore()
    session.isLoading = false
    session.profiles = [{ profileId: 'p1', displayName: 'Alice', avatarColor: '#f00' } as any]
    await wrapper.vm.$nextTick()
    await wrapper.find('.profile-list__button').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('#unlock-passphrase').setValue('password-test-123')
    session.isSubmitting = true
    await wrapper.vm.$nextTick()
    const submit = wrapper.find('button[type="submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
  })

  it('unlock success navigates to /rooms', async () => {
    const wrapper = mountPage()
    const session = useSessionStore()
    session.isLoading = false
    session.profiles = [{ profileId: 'p1', displayName: 'Alice', avatarColor: '#f00' } as any]
    const unlockSpy = vi.spyOn(session, 'unlock').mockResolvedValue(true)
    await wrapper.vm.$nextTick()
    await wrapper.find('.profile-list__button').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('#unlock-passphrase').setValue('password-test-123')
    await wrapper.find('.unlock-form').trigger('submit.prevent')
    await flushPromises()
    expect(unlockSpy).toHaveBeenCalledWith('p1', 'password-test-123')
    expect(mockPush).toHaveBeenCalledWith('/rooms')
  })

  it('surfaces store error when unlock fails', async () => {
    const wrapper = mountPage()
    const session = useSessionStore()
    session.isLoading = false
    session.profiles = [{ profileId: 'p1', displayName: 'Alice', avatarColor: '#f00' } as any]
    vi.spyOn(session, 'unlock').mockResolvedValue(false)
    await wrapper.vm.$nextTick()
    await wrapper.find('.profile-list__button').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('#unlock-passphrase').setValue('password-test-123')
    session.error = 'Incorrect passphrase.'
    await wrapper.find('.unlock-form').trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.text()).toContain('Incorrect passphrase.')
  })

  it('create form rejects mismatched confirmation passphrases', async () => {
    const wrapper = mountPage()
    const session = useSessionStore()
    session.isLoading = false
    session.profiles = []
    await wrapper.vm.$nextTick()
    await wrapper.find('button.btn--primary').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('#create-name').setValue('Carol')
    await wrapper.find('#create-passphrase').setValue('password-test-123')
    await wrapper.find('#create-passphrase-confirm').setValue('password-differs-999')
    await wrapper.find('.create-form').trigger('submit.prevent')
    await flushPromises()
    expect(wrapper.text().toLowerCase()).toContain('do not match')
  })

  it('discloses roles are UI personas only, not a security boundary', () => {
    const wrapper = mountPage()
    expect(wrapper.text().toLowerCase()).toContain('ui personas')
  })
})

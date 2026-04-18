import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import RoomCreatePage from '@/pages/RoomCreatePage.vue'
import { setupNoMockTestEnv, seedActiveSessionProfile } from '../integration/no-mock-test-harness'
import { roomRepository } from '@/services/room-repository'
import { memberRepository } from '@/services/member-repository'
import { LS_KEYS, lsGetJSON } from '@/services/local-storage-keys'
import { useSessionStore } from '@/stores/session-store'
import { useUiStore } from '@/stores/ui-store'

function createPageRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/rooms/create', name: 'room-create', component: RoomCreatePage, props: true },
      { path: '/rooms', name: 'room-list', component: { template: '<div />' } },
      { path: '/workspace/:roomId', name: 'workspace', component: { template: '<div />' }, props: true },
    ],
  })
}

async function mountPage() {
  const router = createPageRouter()
  await router.push('/rooms/create')
  const wrapper = mount(RoomCreatePage, {
    global: {
      plugins: [router],
    },
  })
  await flushPromises()
  return { wrapper, router }
}

async function settleAsyncWork(cycles = 6) {
  for (let i = 0; i < cycles; i += 1) {
    await flushPromises()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
}

describe('RoomCreatePage no-mock integration', () => {
  beforeEach(async () => {
    await setupNoMockTestEnv()
  })

  it('renders room create form controls', async () => {
    await seedActiveSessionProfile()
    const { wrapper } = await mountPage()

    expect(wrapper.find('#room-name').exists()).toBe(true)
    expect(wrapper.find('#room-desc').exists()).toBe(true)
    expect(wrapper.text()).toContain('Create a Room')
  })

  it('shows required error when room name is empty', async () => {
    await seedActiveSessionProfile()
    const { wrapper } = await mountPage()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Room name is required.')
  })

  it('shows required error when room name is whitespace only', async () => {
    await seedActiveSessionProfile()
    const { wrapper } = await mountPage()

    await wrapper.find('#room-name').setValue('   ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Room name is required.')
  })

  it('accepts room name at exactly 100 characters', async () => {
    const profile = await seedActiveSessionProfile()
    const { wrapper } = await mountPage()

    await wrapper.find('#room-name').setValue('a'.repeat(100))
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const rooms = await roomRepository.listAll()
    expect(rooms.length).toBe(1)
    expect(rooms[0].hostProfileId).toBe(profile.profileId)
  })

  it('rejects room name above 100 characters', async () => {
    await seedActiveSessionProfile()
    const { wrapper } = await mountPage()

    await wrapper.find('#room-name').setValue('a'.repeat(101))
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('100 characters or fewer')
    expect((await roomRepository.listAll()).length).toBe(0)
  })

  it('rejects room description above 500 characters', async () => {
    await seedActiveSessionProfile()
    const { wrapper } = await mountPage()

    await wrapper.find('#room-name').setValue('NoMock Room')
    await wrapper.find('#room-desc').setValue('d'.repeat(501))
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('500 characters or fewer')
    expect((await roomRepository.listAll()).length).toBe(0)
  })

  it('shows no active profile error if session has no active profile', async () => {
    await seedActiveSessionProfile()
    const session = useSessionStore()
    session.activeProfileId = null
    session.sessionState = 'active' as any

    const { wrapper } = await mountPage()
    const ui = useUiStore()

    await wrapper.find('#room-name').setValue('No Profile Room')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(ui.toasts.some((t) => t.message.includes('No active profile'))).toBe(true)
    expect((await roomRepository.listAll()).length).toBe(0)
  })

  it('creates room, host member, and navigates to workspace on valid submit', async () => {
    const profile = await seedActiveSessionProfile({ displayName: 'Create Host' })
    const { wrapper, router } = await mountPage()

    await wrapper.find('#room-name').setValue('Sprint Planning')
    await wrapper.find('#room-desc').setValue('Weekly planning room')
    await wrapper.find('form').trigger('submit')
    await settleAsyncWork()

    const rooms = await roomRepository.listAll()
    expect(rooms.length).toBe(1)
    expect(rooms[0].name).toBe('Sprint Planning')

    const members = await memberRepository.listByRoom(rooms[0].roomId)
    expect(members.length).toBe(1)
    expect(members[0].memberId).toBe(profile.profileId)

    expect(router.currentRoute.value.name).toBe('workspace')
    expect(String(router.currentRoute.value.params.roomId)).toBe(rooms[0].roomId)
  })

  it('stores created room in recent rooms localStorage', async () => {
    await seedActiveSessionProfile()
    const { wrapper } = await mountPage()

    await wrapper.find('#room-name').setValue('Recent Room')
    await wrapper.find('form').trigger('submit')
    await settleAsyncWork()

    const recent = lsGetJSON<Array<{ roomId: string; name: string }>>(LS_KEYS.RECENT_ROOMS) ?? []
    expect(recent.length).toBe(1)
    expect(recent[0].name).toBe('Recent Room')
  })

  it('trims room name and description before persistence', async () => {
    await seedActiveSessionProfile()
    const { wrapper } = await mountPage()

    await wrapper.find('#room-name').setValue('   Trimmed Room   ')
    await wrapper.find('#room-desc').setValue('   Trimmed description   ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const rooms = await roomRepository.listAll()
    expect(rooms[0].name).toBe('Trimmed Room')
    expect(rooms[0].description).toBe('Trimmed description')
  })

  it('persists requireApproval true by default', async () => {
    await seedActiveSessionProfile()
    const { wrapper } = await mountPage()

    await wrapper.find('#room-name').setValue('Default Settings Room')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const rooms = await roomRepository.listAll()
    expect(rooms[0].settings.requireApproval).toBe(true)
  })

  it('persists toggled approval settings from the form', async () => {
    await seedActiveSessionProfile()
    const { wrapper } = await mountPage()

    const toggles = wrapper.findAll('input[type="checkbox"]')
    await toggles[0].setValue(false)
    await wrapper.find('#room-name').setValue('Open Room')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const rooms = await roomRepository.listAll()
    expect(rooms[0].settings.requireApproval).toBe(false)
    expect(rooms[0].settings.enableSecondReviewer).toBe(false)
  })
})

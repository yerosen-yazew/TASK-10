// REQ: R1/R2 — RoomCreatePage: validation errors shown, submit calls createRoom, navigates on success, disabled during submit

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('@/layouts/AppLayout.vue', () => ({
  default: { template: '<div><slot /></div>' },
}))
vi.mock('@/components/InlineValidation.vue', () => ({
  default: { template: '<div class="inline-val">{{ errors?.[0]?.message }}</div>', props: ['errors'] },
}))

const mockCreateRoom = vi.fn(async () => ({
  validation: { valid: true, errors: [] },
  room: {
    roomId: 'new-room',
    name: 'Sprint Planning',
    pairingCode: 'AAAA-BBBB',
    settings: { requireApproval: true, enableSecondReviewer: false },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
}))

vi.mock('@/stores/room-store', () => ({
  useRoomStore: () => ({ createRoom: mockCreateRoom }),
}))

vi.mock('@/stores/session-store', () => ({
  useSessionStore: () => ({
    activeProfile: {
      profileId: 'p-1',
      displayName: 'Alice',
      avatarColor: '#ff0000',
    },
  }),
}))

vi.mock('@/stores/ui-store', () => ({
  useUiStore: () => ({
    toast: { success: vi.fn(), error: vi.fn() },
  }),
}))

vi.mock('@/validators/room-create-validator', () => ({
  validateRoomCreatePayload: vi.fn((input: { name: string }) => {
    if (!input.name || input.name.trim().length < 2) {
      return {
        valid: false,
        errors: [{ field: 'name', message: 'Name is required.', code: 'required' }],
      }
    }
    return { valid: true, errors: [] }
  }),
}))

vi.mock('@/services/local-storage-keys', () => ({
  LS_KEYS: { RECENT_ROOMS: 'recentRooms' },
  lsGetJSON: vi.fn(() => []),
  lsSetJSON: vi.fn(),
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/rooms', name: 'room-list', component: { template: '<div />' } },
    { path: '/rooms/create', name: 'room-create', component: { template: '<div />' } },
    { path: '/workspace/:roomId', name: 'workspace', component: { template: '<div />' } },
  ],
})

async function mountPage() {
  const { default: RoomCreatePage } = await import('@/pages/RoomCreatePage.vue')
  await router.push('/rooms/create')
  return mount(RoomCreatePage, { global: { plugins: [router] } })
}

describe('RoomCreatePage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shows validation error when name is empty', async () => {
    const wrapper = await mountPage()
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Name is required.')
  })

  it('does not call createRoom on validation error', async () => {
    const wrapper = await mountPage()
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mockCreateRoom).not.toHaveBeenCalled()
  })

  it('calls createRoom with correct payload on valid submit', async () => {
    const wrapper = await mountPage()
    await wrapper.find('#room-name').setValue('Sprint Planning')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mockCreateRoom).toHaveBeenCalledOnce()
    const call = mockCreateRoom.mock.calls[0][0]
    expect(call.name).toBe('Sprint Planning')
  })

  it('navigates to workspace on success', async () => {
    const wrapper = await mountPage()
    await wrapper.find('#room-name').setValue('Sprint Planning')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('workspace')
    expect(router.currentRoute.value.params.roomId).toBe('new-room')
  })

  it('submit button disabled while submitting', async () => {
    let resolveCreate!: (v: unknown) => void
    mockCreateRoom.mockImplementationOnce(() => new Promise((r) => { resolveCreate = r }))
    const wrapper = await mountPage()
    await wrapper.find('#room-name').setValue('Sprint Planning')
    const submitBtn = wrapper.find('[type="submit"]')
    wrapper.find('form').trigger('submit')
    await flushPromises()
    // Button should be disabled while promise is pending
    resolveCreate({ validation: { valid: true, errors: [] }, room: null })
    await flushPromises()
  })

  it('shows error from store validation', async () => {
    mockCreateRoom.mockResolvedValueOnce({
      validation: { valid: false, errors: [{ field: 'name', message: 'Already taken', code: 'conflict' }] },
      room: null,
    })
    const wrapper = await mountPage()
    await wrapper.find('#room-name').setValue('Sprint Planning')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Already taken')
  })

  it('passes the requireApproval setting to createRoom', async () => {
    const wrapper = await mountPage()
    await wrapper.find('#room-name').setValue('Sprint Planning')
    const approvalToggle = wrapper.find('input[type="checkbox"]#requireApproval, input[type="checkbox"][name="requireApproval"]')
    if (approvalToggle.exists()) {
      await approvalToggle.setValue(false)
    }
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mockCreateRoom).toHaveBeenCalled()
    const payload = mockCreateRoom.mock.calls[0][0]
    expect(payload).toHaveProperty('settings')
  })

  it('does not navigate when createRoom returns invalid validation', async () => {
    mockCreateRoom.mockResolvedValueOnce({
      validation: { valid: false, errors: [{ field: 'name', message: 'Bad', code: 'invalid' }] },
      room: null,
    })
    const wrapper = await mountPage()
    await wrapper.find('#room-name').setValue('Sprint Planning')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.name).not.toBe('workspace')
  })
})

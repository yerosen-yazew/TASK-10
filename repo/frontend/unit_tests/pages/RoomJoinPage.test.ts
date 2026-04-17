// REQ: R2 — RoomJoinPage: pairing code pre-fill, validation, requestJoin call, awaiting state
// REQ: R2 — Awaiting-approval auto-navigates via BroadcastChannel membership-change event

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { MembershipState, RoomRole } from '@/models/room'

vi.mock('@/layouts/AppLayout.vue', () => ({
  default: { template: '<div><slot /></div>' },
}))
vi.mock('@/components/InlineValidation.vue', () => ({
  default: { template: '<div class="inline-val">{{ errors?.[0]?.message }}</div>', props: ['errors'] },
}))

const mockRequestJoin = vi.fn(async () => ({
  validation: { valid: true, errors: [] },
  member: {
    memberId: 'member-1',
    state: MembershipState.Requested,
    role: RoomRole.Participant,
  },
}))

const mockRoomList = [
  {
    roomId: 'room-1',
    name: 'Sprint Room',
    pairingCode: 'AAAA-BBBB',
    settings: { requireApproval: true, enableSecondReviewer: false },
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

vi.mock('@/stores/room-store', () => ({
  useRoomStore: () => ({ requestJoin: mockRequestJoin }),
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
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  }),
}))

vi.mock('@/validators/join-validator', () => ({
  validateJoinPayload: vi.fn((input: { pairingCode: string; displayName: string }) => {
    const errors = []
    if (!input.pairingCode) errors.push({ field: 'pairingCode', message: 'Pairing code is required.', code: 'required' })
    if (!input.displayName) errors.push({ field: 'displayName', message: 'Display name is required.', code: 'required' })
    return { valid: errors.length === 0, errors }
  }),
}))

vi.mock('@/services/room-repository', () => ({
  roomRepository: { listAll: vi.fn(async () => mockRoomList) },
}))

vi.mock('@/services/local-storage-keys', () => ({
  LS_KEYS: { RECENT_ROOMS: 'recentRooms' },
  lsGetJSON: vi.fn(() => []),
  lsSetJSON: vi.fn(),
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

// Capture the broadcast handler so tests can invoke it directly
let capturedBroadcastHandler: ((envelope: any) => void) | null = null
vi.mock('@/services/broadcast-channel-service', () => ({
  subscribeBroadcast: vi.fn((type: string, handler: (e: any) => void) => {
    capturedBroadcastHandler = handler
    return () => { capturedBroadcastHandler = null }
  }),
}))

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/rooms', name: 'room-list', component: { template: '<div />' } },
    { path: '/rooms/join', name: 'room-join', component: { template: '<div />' } },
    { path: '/workspace/:roomId', name: 'workspace', component: { template: '<div />' } },
  ],
})

async function mountPage(query = '') {
  const { default: RoomJoinPage } = await import('@/pages/RoomJoinPage.vue')
  await router.push(`/rooms/join${query}`)
  return mount(RoomJoinPage, { global: { plugins: [router] } })
}

describe('RoomJoinPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    capturedBroadcastHandler = null
  })

  it('pre-fills pairing code from ?code= query param', async () => {
    const wrapper = await mountPage('?code=AAAA-BBBB')
    const codeInput = wrapper.find('#join-code')
    expect((codeInput.element as HTMLInputElement).value).toBe('AAAA-BBBB')
  })

  it('shows validation error when pairing code is empty', async () => {
    const wrapper = await mountPage()
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Pairing code is required.')
  })

  it('shows validation error when display name is empty', async () => {
    const wrapper = await mountPage()
    await wrapper.find('#join-code').setValue('AAAA-BBBB')
    await wrapper.find('#join-name').setValue('')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Display name is required.')
  })

  it('calls requestJoin with matching room on valid submit', async () => {
    const wrapper = await mountPage()
    await wrapper.find('#join-code').setValue('AAAA-BBBB')
    await wrapper.find('#join-name').setValue('Alice')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mockRequestJoin).toHaveBeenCalledOnce()
    const call = mockRequestJoin.mock.calls[0][0]
    expect(call.roomId).toBe('room-1')
    expect(call.displayName).toBe('Alice')
  })

  it('shows awaiting state when approval required and member is Requested', async () => {
    const wrapper = await mountPage()
    await wrapper.find('#join-code').setValue('AAAA-BBBB')
    await wrapper.find('#join-name').setValue('Alice')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Awaiting Approval')
  })

  it('navigates directly when no approval required', async () => {
    const { roomRepository } = await import('@/services/room-repository')
    vi.mocked(roomRepository.listAll).mockResolvedValueOnce([
      { ...mockRoomList[0], settings: { requireApproval: false, enableSecondReviewer: false } },
    ] as any)
    mockRequestJoin.mockResolvedValueOnce({
      validation: { valid: true, errors: [] },
      member: { state: MembershipState.Active, role: RoomRole.Participant, memberId: 'member-1' },
    })
    const wrapper = await mountPage()
    await wrapper.find('#join-code').setValue('AAAA-BBBB')
    await wrapper.find('#join-name').setValue('Alice')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('workspace')
  })

  it('shows error when no room found for pairing code', async () => {
    const { roomRepository } = await import('@/services/room-repository')
    vi.mocked(roomRepository.listAll).mockResolvedValueOnce([])
    const wrapper = await mountPage()
    await wrapper.find('#join-code').setValue('ZZZZ-ZZZZ')
    await wrapper.find('#join-name').setValue('Alice')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('No room found')
  })

  it('auto-navigates to workspace when membership-change approve is received while awaiting', async () => {
    // Reach the awaiting state
    const wrapper = await mountPage()
    await wrapper.find('#join-code').setValue('AAAA-BBBB')
    await wrapper.find('#join-name').setValue('Alice')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Awaiting Approval')
    expect(capturedBroadcastHandler).not.toBeNull()

    // Host approves this member (profileId 'p-1' matches the mocked activeProfile)
    capturedBroadcastHandler!({
      type: 'membership-change',
      tabId: 'other-tab',
      timestamp: new Date().toISOString(),
      roomId: 'room-1',
      payload: { operation: 'approve', memberId: 'p-1' },
    })
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('workspace')
    expect(router.currentRoute.value.params.roomId).toBe('room-1')
  })

  it('does not auto-navigate when approval is for a different member', async () => {
    const wrapper = await mountPage()
    await wrapper.find('#join-code').setValue('AAAA-BBBB')
    await wrapper.find('#join-name').setValue('Alice')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    capturedBroadcastHandler!({
      type: 'membership-change',
      tabId: 'other-tab',
      timestamp: new Date().toISOString(),
      roomId: 'room-1',
      payload: { operation: 'approve', memberId: 'other-member' },
    })
    await flushPromises()

    // Should still be on the join page (awaiting state)
    expect(wrapper.text()).toContain('Awaiting Approval')
  })

  it('does not render a QR scan button', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('.room-join-page__scan-btn').exists()).toBe(false)
  })
})

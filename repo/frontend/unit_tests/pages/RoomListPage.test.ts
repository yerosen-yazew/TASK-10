// REQ: R1/R2 — Room list page: loading/empty/loaded states, recent rooms, navigation

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/layouts/AppLayout.vue', () => ({
  default: { template: '<div><slot /></div>' },
}))

vi.mock('@/engine/room-engine', () => ({
  listRooms: vi.fn(),
}))

vi.mock('@/services/member-repository', () => ({
  memberRepository: {
    countActiveByRoom: vi.fn().mockResolvedValue(0),
  },
}))

import RoomListPage from '@/pages/RoomListPage.vue'
import { listRooms } from '@/engine/room-engine'
import { memberRepository } from '@/services/member-repository'
import { LS_KEYS } from '@/services/local-storage-keys'

function mountPage() {
  return mount(RoomListPage, {
    global: { stubs: { 'router-link': RouterLinkStub } },
  })
}

describe('RoomListPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockReset()
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('calls listRooms on mount and shows loaded rooms', async () => {
    ;(listRooms as any).mockResolvedValue([
      { roomId: 'r1', name: 'Alpha', pairingCode: 'AAAA-BBBB', createdAt: '2026-04-01T00:00:00Z' },
      { roomId: 'r2', name: 'Beta', pairingCode: 'CCCC-DDDD', createdAt: '2026-04-02T00:00:00Z' },
    ])
    const wrapper = mountPage()
    await flushPromises()
    expect(listRooms).toHaveBeenCalled()
    expect(wrapper.findAll('.room-list-page__card').length).toBe(2)
    expect(wrapper.text()).toContain('Alpha')
    expect(wrapper.text()).toContain('Beta')
  })

  it('shows the empty state when no rooms exist', async () => {
    ;(listRooms as any).mockResolvedValue([])
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.find('.empty-state__title').text()).toContain('No rooms yet')
  })

  it('surfaces the error state when listRooms rejects', async () => {
    ;(listRooms as any).mockRejectedValue(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.find('.room-list-page__error').text()).toContain('Failed to load rooms')
  })

  it('reads recent rooms from LocalStorage and renders the recent section', async () => {
    ;(listRooms as any).mockResolvedValue([])
    localStorage.setItem(
      LS_KEYS.RECENT_ROOMS,
      JSON.stringify([
        { roomId: 'r9', name: 'Yesterday', lastAccessed: '2026-04-15T10:00:00Z' },
      ]),
    )
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('Recently Accessed')
    expect(wrapper.text()).toContain('Yesterday')
  })

  it('exposes Create Room and Join Room links', async () => {
    ;(listRooms as any).mockResolvedValue([])
    const wrapper = mountPage()
    await flushPromises()
    const linkTargets = wrapper.findAllComponents(RouterLinkStub).map((l) => l.props('to'))
    expect(linkTargets).toContain('/rooms/create')
    expect(linkTargets).toContain('/rooms/join')
  })

  it('clicking a room card navigates to the workspace route', async () => {
    ;(listRooms as any).mockResolvedValue([
      { roomId: 'r1', name: 'Alpha', pairingCode: 'AAAA', createdAt: '2026-04-01T00:00:00Z' },
    ])
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.find('.room-list-page__card').trigger('click')
    expect(mockPush).toHaveBeenCalledWith({ name: 'workspace', params: { roomId: 'r1' } })
  })

  it('queries active member counts for each room', async () => {
    ;(listRooms as any).mockResolvedValue([
      { roomId: 'r1', name: 'Alpha', pairingCode: 'AAAA', createdAt: '2026-04-01T00:00:00Z' },
    ])
    ;(memberRepository.countActiveByRoom as any).mockResolvedValue(4)
    const wrapper = mountPage()
    await flushPromises()
    expect(memberRepository.countActiveByRoom).toHaveBeenCalledWith('r1')
    expect(wrapper.text()).toContain('4 active')
  })

  it('clicking Copy Link writes the /rooms/join?code=… URL to clipboard', async () => {
    ;(listRooms as any).mockResolvedValue([
      { roomId: 'r1', name: 'Alpha', pairingCode: 'ABCD-1234', createdAt: '2026-04-01T00:00:00Z' },
    ])
    const writeText = vi.fn().mockResolvedValue(undefined)
    const originalClipboard = (navigator as any).clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    try {
      const wrapper = mountPage()
      await flushPromises()
      const copyBtn = wrapper.find('[data-testid="copy-link-r1"]')
      expect(copyBtn.exists()).toBe(true)
      await copyBtn.trigger('click')
      await flushPromises()
      expect(writeText).toHaveBeenCalledOnce()
      const url = writeText.mock.calls[0][0] as string
      expect(url).toContain('/rooms/join?code=ABCD-1234')
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        configurable: true,
      })
    }
  })

  it('Copy Link click does not trigger card navigation', async () => {
    ;(listRooms as any).mockResolvedValue([
      { roomId: 'r1', name: 'Alpha', pairingCode: 'ABCD-1234', createdAt: '2026-04-01T00:00:00Z' },
    ])
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.find('[data-testid="copy-link-r1"]').trigger('click')
    await flushPromises()
    expect(mockPush).not.toHaveBeenCalled()
  })
})

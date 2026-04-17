// REQ: R9 — CursorOverlay: renders remote-member cursors, excludes self, uses avatar color

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const mockCursors = [
  {
    memberId: 'member-1',
    roomId: 'room-1',
    displayName: 'Alice',
    avatarColor: '#ff0000',
    isOnline: true,
    cursor: { x: 100, y: 200, timestamp: 1 },
  },
  {
    memberId: 'member-2',
    roomId: 'room-1',
    displayName: 'Bob',
    avatarColor: '#00ff00',
    isOnline: true,
    cursor: { x: 50, y: 75, timestamp: 1 },
  },
  {
    memberId: 'member-3',
    roomId: 'room-1',
    displayName: 'Carol',
    avatarColor: '#0000ff',
    isOnline: true,
    cursor: null,
  },
]

vi.mock('@/stores/presence-store', () => ({
  usePresenceStore: vi.fn(() => ({
    cursors: mockCursors.filter((c) => c.cursor !== null),
  })),
}))

async function mountOverlay(selfMemberId: string | null) {
  const { default: CursorOverlay } = await import('@/components/workspace/CursorOverlay.vue')
  return mount(CursorOverlay, { props: { selfMemberId } })
}

describe('CursorOverlay', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders one marker per remote cursor with name label', async () => {
    const wrapper = await mountOverlay(null)
    const markers = wrapper.findAll('.cursor-overlay__marker')
    // mockCursors has 2 non-null cursors (member-1 + member-2)
    expect(markers.length).toBe(2)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
  })

  it('excludes self-cursor by selfMemberId prop', async () => {
    const wrapper = await mountOverlay('member-1')
    const markers = wrapper.findAll('.cursor-overlay__marker')
    expect(markers.length).toBe(1)
    expect(wrapper.text()).not.toContain('Alice')
    expect(wrapper.text()).toContain('Bob')
  })

  it('uses member avatarColor on the dot and label', async () => {
    const wrapper = await mountOverlay(null)
    const aliceMarker = wrapper.find('[data-testid="cursor-member-1"]')
    expect(aliceMarker.exists()).toBe(true)
    const dot = aliceMarker.find('.cursor-overlay__dot')
    expect(dot.attributes('style')).toContain('rgb(255, 0, 0)')
  })

  it('positions the marker using cursor.x / cursor.y via CSS transform', async () => {
    const wrapper = await mountOverlay(null)
    const aliceMarker = wrapper.find('[data-testid="cursor-member-1"]')
    const style = aliceMarker.attributes('style') ?? ''
    expect(style).toMatch(/translate\(100px,\s*200px\)/)
  })

  it('renders nothing when there are no cursors', async () => {
    const { usePresenceStore } = await import('@/stores/presence-store')
    vi.mocked(usePresenceStore).mockReturnValueOnce({ cursors: [] } as any)
    const wrapper = await mountOverlay(null)
    expect(wrapper.findAll('.cursor-overlay__marker').length).toBe(0)
  })
})

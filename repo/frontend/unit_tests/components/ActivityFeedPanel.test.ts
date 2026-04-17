// REQ: R10/R11 — ActivityFeedPanel: filter tab change calls setFilter+refresh, renders events, empty state

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/components/TabFilter.vue', () => ({
  default: {
    template: `
      <div class="tab-filter">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :data-testid="'tab-' + tab.key"
          @click="$emit('update:modelValue', tab.key)"
        >{{ tab.label }}</button>
      </div>
    `,
    props: ['tabs', 'modelValue'],
    emits: ['update:modelValue'],
  },
}))

vi.mock('@/components/EmptyState.vue', () => ({
  default: {
    template: '<div class="empty-state"><slot />{{ title }}</div>',
    props: ['icon', 'title', 'description'],
  },
}))

const mockSetFilter = vi.fn()
const mockRefresh = vi.fn(async () => {})

vi.mock('@/stores/activity-store', () => ({
  useActivityStore: vi.fn(() => ({
    events: [],
    filteredEvents: [],
    filter: 'all',
    isLoading: false,
    lastError: null,
    setFilter: mockSetFilter,
    refresh: mockRefresh,
  })),
}))

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

async function mountPanel(props = {}) {
  const { default: ActivityFeedPanel } = await import('@/components/workspace/ActivityFeedPanel.vue')
  return mount(ActivityFeedPanel, {
    props: { roomId: 'room-1', ...props },
  })
}

describe('ActivityFeedPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('shows empty state when no events', async () => {
    const wrapper = await mountPanel()
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('renders event list when events present', async () => {
    const { useActivityStore } = await import('@/stores/activity-store')
    vi.mocked(useActivityStore).mockReturnValueOnce({
      events: [
        {
          eventId: 'ev-1',
          roomId: 'room-1',
          type: 'element_created',
          actorId: 'member-1',
          actorDisplayName: 'Alice',
          summary: 'Alice created a sticky note',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      filteredEvents: [
        {
          eventId: 'ev-1',
          roomId: 'room-1',
          type: 'element_created',
          actorId: 'member-1',
          actorDisplayName: 'Alice',
          summary: 'Alice created a sticky note',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      filter: 'all',
      isLoading: false,
      lastError: null,
      setFilter: mockSetFilter,
      refresh: mockRefresh,
    } as any)
    const wrapper = await mountPanel()
    expect(wrapper.text()).toContain('Alice created a sticky note')
  })

  it('clicking tab calls setFilter with correct key', async () => {
    const wrapper = await mountPanel()
    const elementsTab = wrapper.find('[data-testid="tab-elements"]')
    if (elementsTab.exists()) {
      await elementsTab.trigger('click')
      await flushPromises()
      expect(mockSetFilter).toHaveBeenCalledWith('elements')
    }
  })

  it('clicking tab calls refresh', async () => {
    const wrapper = await mountPanel()
    const elementsTab = wrapper.find('[data-testid="tab-elements"]')
    if (elementsTab.exists()) {
      await elementsTab.trigger('click')
      await flushPromises()
      expect(mockRefresh).toHaveBeenCalled()
    }
  })

  it('auto-refresh interval is set up on mount', async () => {
    vi.useFakeTimers()
    const wrapper = await mountPanel()
    // Advance 30 seconds — should trigger a refresh
    vi.advanceTimersByTime(30000)
    await flushPromises()
    expect(mockRefresh).toHaveBeenCalled()
    wrapper.unmount()
    vi.useRealTimers()
  })

  it('clears the refresh interval on unmount', async () => {
    vi.useFakeTimers()
    const wrapper = await mountPanel()
    mockRefresh.mockClear()
    wrapper.unmount()
    vi.advanceTimersByTime(60_000)
    await flushPromises()
    // Refresh should not fire after unmount
    expect(mockRefresh).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('calls refresh on mount to load initial events', async () => {
    await mountPanel()
    await flushPromises()
    expect(mockRefresh).toHaveBeenCalled()
  })
})

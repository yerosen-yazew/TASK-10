// REQ: R17 — Snapshot drawer: timeline display, rollback trigger, loading/empty/error states

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const mockRollback = vi.fn(async () => null)
const mockRefresh = vi.fn(async () => {})

const mockSnapshots = [
  {
    snapshotId: 'snap-1',
    roomId: 'room-1',
    sequenceNumber: 1,
    createdAt: '2026-01-01T10:00:00.000Z',
    sizeBytes: 1024,
    data: {},
  },
  {
    snapshotId: 'snap-2',
    roomId: 'room-1',
    sequenceNumber: 2,
    createdAt: '2026-01-01T10:05:00.000Z',
    sizeBytes: 2048,
    data: {},
  },
]

vi.mock('@/stores/snapshot-store', () => ({
  useSnapshotStore: vi.fn(() => ({
    snapshots: mockSnapshots,
    isLoading: false,
    isRollingBack: false,
    lastError: null,
    lastRollback: null,
    refresh: mockRefresh,
    rollback: mockRollback,
  })),
}))

vi.mock('@/stores/session-store', () => ({
  useSessionStore: () => ({
    activeProfileId: 'member-1',
    activeProfile: { profileId: 'member-1', displayName: 'Alice', avatarColor: '#ff0000' },
  }),
}))

vi.mock('@/components/LoadingSpinner.vue', () => ({
  default: { template: '<div class="loading-spinner" />' },
}))
vi.mock('@/components/EmptyState.vue', () => ({
  default: { template: '<div class="empty-state">{{ title }}</div>', props: ['title', 'description'] },
}))

async function mountDrawer(propsData = {}, storeOverrides = {}) {
  const { useSnapshotStore } = await import('@/stores/snapshot-store')
  vi.mocked(useSnapshotStore).mockReturnValue({
    snapshots: mockSnapshots,
    isLoading: false,
    isRollingBack: false,
    lastError: null,
    lastRollback: null,
    refresh: mockRefresh,
    rollback: mockRollback,
    ...storeOverrides,
  } as any)

  const { default: SnapshotDrawer } = await import('@/components/workspace/SnapshotDrawer.vue')
  return mount(SnapshotDrawer, {
    props: { roomId: 'room-1', isHost: true, ...propsData },
    attachTo: document.body,
  })
}

describe('SnapshotDrawer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders snapshot count in header', async () => {
    const wrapper = await mountDrawer()
    expect(wrapper.text()).toContain('2')
  })

  it('renders snapshot items', async () => {
    const wrapper = await mountDrawer()
    expect(wrapper.find('[data-testid="snapshot-item-snap-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="snapshot-item-snap-2"]').exists()).toBe(true)
  })

  it('shows Restore buttons when isHost=true', async () => {
    const wrapper = await mountDrawer({ isHost: true })
    expect(wrapper.find('[data-testid="rollback-btn-snap-1"]').exists()).toBe(true)
  })

  it('hides Restore buttons when isHost=false', async () => {
    const wrapper = await mountDrawer({ isHost: false })
    expect(wrapper.find('[data-testid="rollback-btn-snap-1"]').exists()).toBe(false)
  })

  it('calls rollback when Restore button clicked', async () => {
    const wrapper = await mountDrawer({ isHost: true })
    await wrapper.find('[data-testid="rollback-btn-snap-2"]').trigger('click')
    await flushPromises()
    expect(mockRollback).toHaveBeenCalledWith('room-1', 'snap-2', expect.any(Object))
  })

  it('disables Restore button when isRollingBack=true', async () => {
    const wrapper = await mountDrawer({ isHost: true }, { isRollingBack: true, snapshots: mockSnapshots, lastError: null, lastRollback: null, refresh: mockRefresh, rollback: mockRollback })
    const btn = wrapper.find('[data-testid="rollback-btn-snap-1"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows empty state when no snapshots', async () => {
    const wrapper = await mountDrawer({}, { snapshots: [], isLoading: false, isRollingBack: false, lastError: null, lastRollback: null, refresh: mockRefresh, rollback: mockRollback })
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('shows loading spinner when isLoading=true', async () => {
    const wrapper = await mountDrawer({}, { snapshots: [], isLoading: true, isRollingBack: false, lastError: null, lastRollback: null, refresh: mockRefresh, rollback: mockRollback })
    expect(wrapper.find('.loading-spinner').exists()).toBe(true)
  })

  it('shows error message when lastError is set', async () => {
    const wrapper = await mountDrawer({}, { snapshots: [], isLoading: false, isRollingBack: false, lastError: 'Rollback failed.', lastRollback: null, refresh: mockRefresh, rollback: mockRollback })
    expect(wrapper.find('[data-testid="snapshot-error"]').text()).toBe('Rollback failed.')
  })

  it('shows post-rollback summary when lastRollback is set', async () => {
    const wrapper = await mountDrawer({}, {
      snapshots: mockSnapshots,
      isLoading: false,
      isRollingBack: false,
      lastError: null,
      lastRollback: {
        rollbackId: 'rb-1',
        roomId: 'room-1',
        sourceSnapshotId: 'snap-1',
        sourceSequenceNumber: 1,
        initiatorId: 'member-1',
        initiatorDisplayName: 'Alice',
        resultingSnapshotId: 'snap-3',
        rolledBackAt: '2026-01-01T10:10:00.000Z',
      },
      refresh: mockRefresh,
      rollback: mockRollback,
    })
    expect(wrapper.find('[data-testid="rollback-summary"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rollback-summary"]').text()).toContain('#1')
    expect(wrapper.find('[data-testid="rollback-summary"]').text()).toContain('Alice')
  })

  it('calls refresh on mount', async () => {
    await mountDrawer()
    await flushPromises()
    expect(mockRefresh).toHaveBeenCalledWith('room-1')
  })
})

// REQ: R1/R15 — WorkspaceSettingsPage: room settings (host), theme preference, avatar color

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const mockSetTheme = vi.fn()
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
const mockPush = vi.fn()
const mockLoadRoom = vi.fn(async () => {})
const mockUpdateRoomSettings = vi.fn(async () => {})

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mockPush }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('@/layouts/AppLayout.vue', () => ({
  default: { template: '<div><slot /></div>' },
}))

vi.mock('@/engine/room-engine', () => ({
  updateRoomSettings: mockUpdateRoomSettings,
}))

vi.mock('@/stores/room-store', () => ({
  useRoomStore: vi.fn(() => ({
    activeRoom: {
      roomId: 'room-1',
      name: 'Test Room',
      settings: { requireApproval: true, enableSecondReviewer: false },
    },
    isLoading: false,
    members: [{ memberId: 'member-1', role: 'host', state: 'active', displayName: 'Alice' }],
    loadRoom: mockLoadRoom,
  })),
}))

vi.mock('@/stores/session-store', () => ({
  useSessionStore: () => ({
    activeProfileId: 'member-1',
    activeProfile: { profileId: 'member-1', displayName: 'Alice', avatarColor: '#ef4444' },
  }),
}))

vi.mock('@/stores/ui-store', () => ({
  useUiStore: () => ({
    toast: { success: mockToastSuccess, error: mockToastError },
  }),
}))

vi.mock('@/stores/preferences-store', () => ({
  usePreferencesStore: vi.fn(() => ({
    theme: 'light',
    lastTool: 'select',
    setTheme: mockSetTheme,
    setLastTool: vi.fn(),
  })),
}))

vi.mock('@/services/local-storage-keys', () => ({
  LS_KEYS: {
    THEME: 'forgeroom:theme',
    LAST_TOOL: 'forgeroom:lastTool',
    AVATAR_COLOR: 'forgeroom:avatarColor',
  },
  lsSetString: vi.fn(),
  lsGetString: vi.fn(() => null),
}))

async function mountPage() {
  const { default: WorkspaceSettingsPage } = await import('@/pages/WorkspaceSettingsPage.vue')
  return mount(WorkspaceSettingsPage, {
    props: { roomId: 'room-1' },
    attachTo: document.body,
  })
}

describe('WorkspaceSettingsPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders room name', async () => {
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('Test Room')
  })

  it('shows room settings form for Host', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('calls updateRoomSettings and navigates on save', async () => {
    const wrapper = await mountPage()
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mockUpdateRoomSettings).toHaveBeenCalledWith('room-1', expect.any(Object))
    expect(mockPush).toHaveBeenCalledWith({ name: 'workspace', params: { roomId: 'room-1' } })
  })

  it('shows error toast when save fails', async () => {
    mockUpdateRoomSettings.mockRejectedValueOnce(new Error('DB error'))
    const wrapper = await mountPage()
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mockToastError).toHaveBeenCalledWith('Failed to save settings.')
  })

  it('renders theme selector', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="theme-select"]').exists()).toBe(true)
  })

  it('renders avatar color grid', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="avatar-color-grid"]').exists()).toBe(true)
  })

  it('calls setTheme when Save Preferences clicked', async () => {
    const wrapper = await mountPage()
    const select = wrapper.find('[data-testid="theme-select"]')
    await select.setValue('dark')
    await wrapper.find('[data-testid="save-prefs-btn"]').trigger('click')
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
    expect(mockToastSuccess).toHaveBeenCalledWith('Preferences saved.')
  })

  it('shows color swatches for each color', async () => {
    const wrapper = await mountPage()
    const swatches = wrapper.findAll('[data-testid^="color-swatch-"]')
    expect(swatches.length).toBeGreaterThan(0)
  })
})

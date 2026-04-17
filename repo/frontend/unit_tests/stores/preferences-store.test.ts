// REQ: R20 — Preferences store: theme + last tool persisted to LocalStorage

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const lsStorage: Record<string, string> = {}

vi.mock('@/services/local-storage-keys', () => ({
  LS_KEYS: {
    THEME: 'theme',
    LAST_TOOL: 'lastTool',
    RECENT_ROOMS: 'recentRooms',
  },
  lsGetString: vi.fn((key: string) => lsStorage[key] ?? null),
  lsSetString: vi.fn((key: string, value: string) => { lsStorage[key] = value }),
  lsGetJSON: vi.fn((key: string) => {
    const raw = lsStorage[key]
    return raw ? JSON.parse(raw) : null
  }),
  lsSetJSON: vi.fn((key: string, value: unknown) => {
    lsStorage[key] = JSON.stringify(value)
  }),
}))

describe('preferences-store', () => {
  beforeEach(() => {
    Object.keys(lsStorage).forEach((k) => delete lsStorage[k])
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('has default theme "light" when nothing in localStorage', async () => {
    const { usePreferencesStore } = await import('@/stores/preferences-store')
    const store = usePreferencesStore()
    expect(store.theme).toBe('light')
  })

  it('reads theme from localStorage on init', async () => {
    lsStorage['theme'] = 'dark'
    const { usePreferencesStore } = await import('@/stores/preferences-store')
    const store = usePreferencesStore()
    expect(store.theme).toBe('dark')
  })

  it('setTheme persists to localStorage', async () => {
    const { usePreferencesStore } = await import('@/stores/preferences-store')
    const { lsSetString } = await import('@/services/local-storage-keys')
    const store = usePreferencesStore()
    store.setTheme('dark')
    expect(store.theme).toBe('dark')
    expect(lsSetString).toHaveBeenCalledWith('theme', 'dark')
  })

  it('setLastTool persists to localStorage', async () => {
    const { usePreferencesStore } = await import('@/stores/preferences-store')
    const { lsSetString } = await import('@/services/local-storage-keys')
    const store = usePreferencesStore()
    store.setLastTool('sticky')
    expect(store.lastTool).toBe('sticky')
    expect(lsSetString).toHaveBeenCalledWith('lastTool', 'sticky')
  })

  it('has default lastTool "select" when nothing in localStorage', async () => {
    const { usePreferencesStore } = await import('@/stores/preferences-store')
    const store = usePreferencesStore()
    expect(store.lastTool).toBe('select')
  })

  it('reads lastTool from localStorage on init', async () => {
    lsStorage['lastTool'] = 'pen'
    const { usePreferencesStore } = await import('@/stores/preferences-store')
    const store = usePreferencesStore()
    expect(store.lastTool).toBe('pen')
  })
})

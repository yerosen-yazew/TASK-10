// REQ: stores barrel exports

import { describe, expect, it } from 'vitest'
import { createPinia } from '@/stores'
import {
  useSessionStore,
  useUiStore,
  useRoomStore,
  useElementStore,
  useCommentStore,
  useChatStore,
  usePresenceStore,
  useActivityStore,
  useSnapshotStore,
  usePreferencesStore,
  useImportExportStore,
  usePeersStore,
} from '@/stores'

describe('stores barrel', () => {
  it('re-exports createPinia and all store factories', () => {
    expect(typeof createPinia).toBe('function')
    expect(typeof useSessionStore).toBe('function')
    expect(typeof useUiStore).toBe('function')
    expect(typeof useRoomStore).toBe('function')
    expect(typeof useElementStore).toBe('function')
    expect(typeof useCommentStore).toBe('function')
    expect(typeof useChatStore).toBe('function')
    expect(typeof usePresenceStore).toBe('function')
    expect(typeof useActivityStore).toBe('function')
    expect(typeof useSnapshotStore).toBe('function')
    expect(typeof usePreferencesStore).toBe('function')
    expect(typeof useImportExportStore).toBe('function')
    expect(typeof usePeersStore).toBe('function')
  })
})

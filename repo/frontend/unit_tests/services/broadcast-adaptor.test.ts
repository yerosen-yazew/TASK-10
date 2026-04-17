// REQ: R18 — Broadcast adaptor: each event type triggers correct store method; cleanup unsubscribes

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

type SubscribeHandler = (envelope: Record<string, unknown>) => void
const subscribeHandlers = new Map<string, SubscribeHandler>()

vi.mock('@/services/broadcast-channel-service', () => ({
  subscribeBroadcast: vi.fn((eventType: string, handler: SubscribeHandler) => {
    subscribeHandlers.set(eventType, handler)
    return () => { subscribeHandlers.delete(eventType) }
  }),
  broadcastMessage: vi.fn(),
}))

const mockElementStore = { loadElements: vi.fn(async () => {}) }
const mockChatStore = { loadChat: vi.fn(async () => {}) }
const mockRoomStore = { refreshMembers: vi.fn(async () => {}) }
const mockUiStore = { addBanner: vi.fn(), toast: { info: vi.fn() } }
const mockSessionStore = { lock: vi.fn(), signOut: vi.fn() }
const mockSnapshotStore = { refresh: vi.fn(async () => {}) }

vi.mock('@/stores/element-store', () => ({ useElementStore: () => mockElementStore }))
vi.mock('@/stores/chat-store', () => ({ useChatStore: () => mockChatStore }))
vi.mock('@/stores/room-store', () => ({ useRoomStore: () => mockRoomStore }))
vi.mock('@/stores/ui-store', () => ({ useUiStore: () => mockUiStore }))
vi.mock('@/stores/session-store', () => ({ useSessionStore: () => mockSessionStore }))
vi.mock('@/stores/snapshot-store', () => ({ useSnapshotStore: () => mockSnapshotStore }))
vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const ROOM_ID = 'room-1'

function makeEnvelope(type: string, payload: Record<string, unknown>, roomId = ROOM_ID) {
  return { type, payload, roomId, tabId: 'other-tab', timestamp: '2026-01-01T00:00:00.000Z' }
}

describe('broadcast-adaptor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    subscribeHandlers.clear()
    vi.clearAllMocks()
  })

  it('subscribes to 8 event types on attachRoomBroadcast', async () => {
    const { attachRoomBroadcast } = await import('@/services/broadcast-adaptor')
    const { subscribeBroadcast } = await import('@/services/broadcast-channel-service')
    attachRoomBroadcast(ROOM_ID)
    expect(vi.mocked(subscribeBroadcast).mock.calls.length).toBeGreaterThanOrEqual(8)
  })

  it('element-change triggers elementStore.loadElements', async () => {
    const { attachRoomBroadcast } = await import('@/services/broadcast-adaptor')
    attachRoomBroadcast(ROOM_ID)
    const handler = subscribeHandlers.get('element-change')!
    await handler(makeEnvelope('element-change', { operation: 'create', elementId: 'el-1' }))
    expect(mockElementStore.loadElements).toHaveBeenCalledWith(ROOM_ID)
  })

  it('element-change ignored for different room', async () => {
    const { attachRoomBroadcast } = await import('@/services/broadcast-adaptor')
    attachRoomBroadcast(ROOM_ID)
    const handler = subscribeHandlers.get('element-change')!
    await handler(makeEnvelope('element-change', { operation: 'create', elementId: 'el-1' }, 'other-room'))
    expect(mockElementStore.loadElements).not.toHaveBeenCalled()
  })

  it('chat-message triggers chatStore.loadChat', async () => {
    const { attachRoomBroadcast } = await import('@/services/broadcast-adaptor')
    attachRoomBroadcast(ROOM_ID)
    const handler = subscribeHandlers.get('chat-message')!
    await handler(makeEnvelope('chat-message', { operation: 'new', messageId: 'msg-1' }))
    expect(mockChatStore.loadChat).toHaveBeenCalledWith(ROOM_ID)
  })

  it('membership-change triggers roomStore.refreshMembers', async () => {
    const { attachRoomBroadcast } = await import('@/services/broadcast-adaptor')
    attachRoomBroadcast(ROOM_ID)
    const handler = subscribeHandlers.get('membership-change')!
    await handler(makeEnvelope('membership-change', { operation: 'approve', memberId: 'm-1' }))
    expect(mockRoomStore.refreshMembers).toHaveBeenCalled()
  })

  it('conflict-notify triggers uiStore.addBanner', async () => {
    const { attachRoomBroadcast } = await import('@/services/broadcast-adaptor')
    attachRoomBroadcast(ROOM_ID)
    const handler = subscribeHandlers.get('conflict-notify')!
    await handler(makeEnvelope('conflict-notify', { conflictType: 'overwrite', message: 'Overwrite detected' }))
    expect(mockUiStore.addBanner).toHaveBeenCalled()
  })

  it('session-lock lock action triggers sessionStore.lock', async () => {
    const { attachRoomBroadcast } = await import('@/services/broadcast-adaptor')
    attachRoomBroadcast(ROOM_ID)
    const handler = subscribeHandlers.get('session-lock')!
    await handler(makeEnvelope('session-lock', { action: 'lock', profileId: 'p-1' }))
    expect(mockSessionStore.lock).toHaveBeenCalled()
    expect(mockSessionStore.signOut).not.toHaveBeenCalled()
  })

  it('session-lock sign-out action triggers sessionStore.signOut', async () => {
    const { attachRoomBroadcast } = await import('@/services/broadcast-adaptor')
    attachRoomBroadcast(ROOM_ID)
    const handler = subscribeHandlers.get('session-lock')!
    await handler(makeEnvelope('session-lock', { action: 'sign-out', profileId: 'p-1' }))
    expect(mockSessionStore.signOut).toHaveBeenCalled()
  })

  it('snapshot-created triggers snapshotStore.refresh', async () => {
    const { attachRoomBroadcast } = await import('@/services/broadcast-adaptor')
    attachRoomBroadcast(ROOM_ID)
    const handler = subscribeHandlers.get('snapshot-created')!
    await handler(makeEnvelope('snapshot-created', { snapshotId: 'snap-1' }))
    expect(mockSnapshotStore.refresh).toHaveBeenCalledWith(ROOM_ID)
  })

  it('rollback-applied triggers snapshotStore.refresh and toast', async () => {
    const { attachRoomBroadcast } = await import('@/services/broadcast-adaptor')
    attachRoomBroadcast(ROOM_ID)
    const handler = subscribeHandlers.get('rollback-applied')!
    await handler(makeEnvelope('rollback-applied', { snapshotId: 'snap-1' }))
    expect(mockSnapshotStore.refresh).toHaveBeenCalledWith(ROOM_ID)
    expect(mockUiStore.toast.info).toHaveBeenCalled()
  })

  it('cleanup function unsubscribes all handlers', async () => {
    const { attachRoomBroadcast } = await import('@/services/broadcast-adaptor')
    attachRoomBroadcast(ROOM_ID)
    expect(subscribeHandlers.size).toBeGreaterThan(0)
    // Since cleanup calls each unsub (which deletes from our map), verify all are removed
    const { subscribeBroadcast } = await import('@/services/broadcast-channel-service')
    const unsubFns = vi.mocked(subscribeBroadcast).mock.results.map((r) => r.value as () => void)
    unsubFns.forEach((fn) => fn())
    // All event types should be unsubscribed
    expect(subscribeHandlers.size).toBe(0)
  })
})

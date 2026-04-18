// REQ: Workspace page lower-mock integration tests using real router/components/stores

import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '@/router'
import WorkspacePage from '@/pages/WorkspacePage.vue'
import CanvasHost from '@/components/workspace/CanvasHost.vue'
import ChatPanel from '@/components/workspace/ChatPanel.vue'
import CommentDrawer from '@/components/workspace/CommentDrawer.vue'
import { useSessionStore } from '@/stores/session-store'
import { useRoomStore } from '@/stores/room-store'
import { usePresenceStore } from '@/stores/presence-store'
import { useUiStore } from '@/stores/ui-store'
import { createProfile } from '@/services/profile-service'
import { createRoom } from '@/engine/room-engine'
import { closeAll } from '@/services/webrtc-peer-service'
import { closeBroadcastChannel } from '@/services/broadcast-channel-service'
import { DB_NAME } from '@/models/constants'

async function resetDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

async function seedActiveHostRoom() {
  const host = await createProfile('NoMock Host', '#2563eb', 'Password123!')
  const created = await createRoom({
    name: 'NoMock Room',
    description: 'Workspace page no-mock integration',
    hostProfileId: host.profileId,
    hostDisplayName: host.displayName,
    hostAvatarColor: host.avatarColor,
    settings: {
      requireApproval: false,
      enableSecondReviewer: false,
    },
  })

  const session = useSessionStore()
  session.activeProfileId = host.profileId
  session.sessionState = 'active' as any
  session.profiles = [host] as any

  return {
    roomId: created.room!.roomId,
    host,
  }
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  })
}

describe('WorkspacePage no-mock integration', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    closeAll()
    closeBroadcastChannel()
    localStorage.clear()
    await resetDb()
  })

  it('mounts real CanvasHost, ChatPanel, and CommentDrawer without component mocking', async () => {
    const { roomId } = await seedActiveHostRoom()
    const router = createTestRouter()

    const wrapper = mount(WorkspacePage, {
      props: { roomId },
      global: { plugins: [router] },
    })

    await flushPromises()

    expect(wrapper.findComponent(CanvasHost).exists()).toBe(true)
    expect(wrapper.findComponent(ChatPanel).exists()).toBe(true)
    expect(wrapper.findComponent(CommentDrawer).exists()).toBe(true)

    wrapper.unmount()
  })

  it('passes actor identity into real child components', async () => {
    const { roomId, host } = await seedActiveHostRoom()
    const router = createTestRouter()

    const wrapper = mount(WorkspacePage, {
      props: { roomId },
      global: { plugins: [router] },
    })

    await flushPromises()

    const canvas = wrapper.findComponent(CanvasHost)
    const chat = wrapper.findComponent(ChatPanel)
    const drawer = wrapper.findComponent(CommentDrawer)

    expect(canvas.props('actor')).toEqual({ memberId: host.profileId, displayName: host.displayName })
    expect(chat.props('actor')).toEqual({ memberId: host.profileId, displayName: host.displayName })
    expect(drawer.props('actor')).toEqual({ memberId: host.profileId, displayName: host.displayName })

    wrapper.unmount()
  })

  it('loads the room into room store with a matching room id', async () => {
    const { roomId } = await seedActiveHostRoom()
    const router = createTestRouter()

    mount(WorkspacePage, {
      props: { roomId },
      global: { plugins: [router] },
    })

    await flushPromises()

    const room = useRoomStore()
    expect(room.activeRoom?.roomId).toBe(roomId)
  })

  it('opens comment drawer when CanvasHost emits open-comments event', async () => {
    const { roomId } = await seedActiveHostRoom()
    const router = createTestRouter()

    const wrapper = mount(WorkspacePage, {
      props: { roomId },
      global: { plugins: [router] },
    })

    await flushPromises()

    const canvas = wrapper.findComponent(CanvasHost)
    canvas.vm.$emit('open-comments', 'element-xyz')
    await flushPromises()

    const drawer = wrapper.findComponent(CommentDrawer)
    expect(drawer.props('elementId')).toBe('element-xyz')

    wrapper.unmount()
  })

  it('updates presence store cursor when CanvasHost emits cursor-move', async () => {
    const { roomId, host } = await seedActiveHostRoom()
    const router = createTestRouter()

    const wrapper = mount(WorkspacePage, {
      props: { roomId },
      global: { plugins: [router] },
    })

    await flushPromises()

    const presence = usePresenceStore()
    presence.attach(roomId)
    presence.setSelf({
      roomId,
      memberId: host.profileId,
      displayName: host.displayName,
      avatarColor: host.avatarColor,
      isOnline: true,
      currentTool: null,
      cursor: null,
      lastSeenAt: new Date().toISOString(),
    })

    const canvas = wrapper.findComponent(CanvasHost)
    canvas.vm.$emit('cursor-move', { x: 42, y: 84 })
    await flushPromises()

    const selfPresence = presence.cursors.find((entry) => entry.memberId === host.profileId)
    expect(selfPresence?.cursor?.x).toBe(42)
    expect(selfPresence?.cursor?.y).toBe(84)

    wrapper.unmount()
  })

  it('redirects to room list when room id does not exist', async () => {
    await seedActiveHostRoom()
    const router = createTestRouter()
    const ui = useUiStore()

    mount(WorkspacePage, {
      props: { roomId: 'missing-room-id' },
      global: { plugins: [router] },
    })

    await flushPromises()

    expect(ui.toasts.some((t) => t.message.includes('Room not found'))).toBe(true)
  })

  it('renders chat panel with matching room id prop', async () => {
    const { roomId } = await seedActiveHostRoom()
    const router = createTestRouter()

    const wrapper = mount(WorkspacePage, {
      props: { roomId },
      global: { plugins: [router] },
    })

    await flushPromises()

    const chat = wrapper.findComponent(ChatPanel)
    expect(chat.props('roomId')).toBe(roomId)

    wrapper.unmount()
  })

})

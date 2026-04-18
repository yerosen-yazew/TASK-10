import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import RoomJoinPage from '@/pages/RoomJoinPage.vue'
import { setupNoMockTestEnv, seedActiveHostRoom, seedActiveSessionProfile } from '../integration/no-mock-test-harness'
import { roomRepository } from '@/services/room-repository'
import { memberRepository } from '@/services/member-repository'
import { useSessionStore } from '@/stores/session-store'
import { useUiStore } from '@/stores/ui-store'
import { LS_KEYS, lsGetJSON } from '@/services/local-storage-keys'
import { MembershipState, RoomRole } from '@/models/room'
import { BROADCAST_CHANNEL_NAME } from '@/models/constants'
import { closeBroadcastChannel, initBroadcastChannel } from '@/services/broadcast-channel-service'

function createPageRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/rooms/join', name: 'room-join', component: RoomJoinPage, props: true },
      { path: '/rooms', name: 'room-list', component: { template: '<div />' } },
      { path: '/workspace/:roomId', name: 'workspace', component: { template: '<div />' }, props: true },
    ],
  })
}

async function mountPage(query = '') {
  const router = createPageRouter()
  await router.push(`/rooms/join${query}`)
  const wrapper = mount(RoomJoinPage, {
    global: {
      plugins: [router],
    },
  })
  await flushPromises()
  return { wrapper, router }
}

async function settleAsyncWork(cycles = 6) {
  for (let i = 0; i < cycles; i += 1) {
    await flushPromises()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
}

describe('RoomJoinPage no-mock integration', () => {
  beforeEach(async () => {
    await setupNoMockTestEnv()
  })

  it('pre-fills pairing code from route query', async () => {
    const { wrapper } = await mountPage('?code=ABCD-EFGH')
    expect((wrapper.find('#join-code').element as HTMLInputElement).value).toBe('ABCD-EFGH')
  })

  it('shows required pairing code validation error on empty submit', async () => {
    await seedActiveSessionProfile()
    const { wrapper } = await mountPage()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Pairing code is required.')
  })

  it('shows invalid format error for forbidden pairing-code characters', async () => {
    await seedActiveSessionProfile()
    const { wrapper } = await mountPage()

    await wrapper.find('#join-code').setValue('AB0D-EF1G')
    await wrapper.find('#join-name').setValue('Join User')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Pairing code format is invalid')
  })

  it('shows required display-name validation error when blank', async () => {
    await seedActiveSessionProfile()
    const { room } = await seedActiveHostRoom()
    const { wrapper } = await mountPage()

    await wrapper.find('#join-code').setValue(room.pairingCode)
    await wrapper.find('#join-name').setValue('')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Display name is required.')
  })

  it('shows not-found error for unknown pairing code', async () => {
    await seedActiveSessionProfile()
    const { wrapper } = await mountPage()

    await wrapper.find('#join-code').setValue('ABCD-EFGH')
    await wrapper.find('#join-name').setValue('Join User')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('No room found with that pairing code.')
  })

  it('submits join request and transitions to awaiting for approval-required room', async () => {
    const { room } = await seedActiveHostRoom({ requireApproval: true })
    const joiner = await seedActiveSessionProfile({ displayName: 'Joiner' })
    const { wrapper } = await mountPage()

    await wrapper.find('#join-code').setValue(room.pairingCode)
    await wrapper.find('#join-name').setValue(joiner.displayName)
    await wrapper.find('form').trigger('submit')
    await settleAsyncWork()

    expect(wrapper.text()).toContain('Awaiting Approval')

    const member = await memberRepository.find(room.roomId, joiner.profileId)
    expect(member?.state).toBe(MembershipState.Requested)
  })

  it('navigates to workspace for approval-disabled room', async () => {
    const { room } = await seedActiveHostRoom({ requireApproval: false })
    const joiner = await seedActiveSessionProfile({ displayName: 'Fast Joiner' })
    const { wrapper, router } = await mountPage()

    await wrapper.find('#join-code').setValue(room.pairingCode)
    await wrapper.find('#join-name').setValue(joiner.displayName)
    await wrapper.find('form').trigger('submit')
    await settleAsyncWork()

    expect(router.currentRoute.value.name).toBe('workspace')
    expect(String(router.currentRoute.value.params.roomId)).toBe(room.roomId)
  })

  it('records room entry in recent rooms after successful request', async () => {
    const { room } = await seedActiveHostRoom({ requireApproval: true })
    const joiner = await seedActiveSessionProfile({ displayName: 'Recent Joiner' })
    const { wrapper } = await mountPage()

    await wrapper.find('#join-code').setValue(room.pairingCode)
    await wrapper.find('#join-name').setValue(joiner.displayName)
    await wrapper.find('form').trigger('submit')
    await settleAsyncWork()

    const recent = lsGetJSON<Array<{ roomId: string; name: string }>>(LS_KEYS.RECENT_ROOMS) ?? []
    expect(recent.some((r) => r.roomId === room.roomId)).toBe(true)
  })

  it('auto-navigates when a membership approve broadcast arrives for active profile', async () => {
    initBroadcastChannel('tab-local')
    const { room } = await seedActiveHostRoom({ requireApproval: true })
    const joiner = await seedActiveSessionProfile({ displayName: 'Broadcast Joiner' })
    const { wrapper, router } = await mountPage()

    await wrapper.find('#join-code').setValue(room.pairingCode)
    await wrapper.find('#join-name').setValue(joiner.displayName)
    await wrapper.find('form').trigger('submit')
    await settleAsyncWork()

    expect(wrapper.text()).toContain('Awaiting Approval')

    const externalChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    externalChannel.postMessage({
      type: 'membership-change',
      tabId: 'tab-external',
      timestamp: new Date().toISOString(),
      roomId: room.roomId,
      payload: {
        operation: 'approve',
        memberId: joiner.profileId,
      },
    })

    await settleAsyncWork()

    expect(router.currentRoute.value.name).toBe('workspace')
    expect(String(router.currentRoute.value.params.roomId)).toBe(room.roomId)

    externalChannel.close()
    closeBroadcastChannel()
  })

  it('does not navigate on membership approve broadcast for a different member', async () => {
    initBroadcastChannel('tab-local')
    const { room } = await seedActiveHostRoom({ requireApproval: true })
    const joiner = await seedActiveSessionProfile({ displayName: 'Target Joiner' })
    const { wrapper, router } = await mountPage()

    await wrapper.find('#join-code').setValue(room.pairingCode)
    await wrapper.find('#join-name').setValue(joiner.displayName)
    await wrapper.find('form').trigger('submit')
    await settleAsyncWork()

    const externalChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)
    externalChannel.postMessage({
      type: 'membership-change',
      tabId: 'tab-external',
      timestamp: new Date().toISOString(),
      roomId: room.roomId,
      payload: {
        operation: 'approve',
        memberId: 'different-member',
      },
    })

    await settleAsyncWork()

    expect(router.currentRoute.value.name).toBe('room-join')
    expect(wrapper.text()).toContain('Awaiting Approval')

    externalChannel.close()
    closeBroadcastChannel()
  })

  it('stores requested role selected by user', async () => {
    const { room } = await seedActiveHostRoom({ requireApproval: true })
    const joiner = await seedActiveSessionProfile({ displayName: 'Guest Joiner' })
    const { wrapper } = await mountPage()

    await wrapper.find('#join-code').setValue(room.pairingCode)
    await wrapper.find('#join-name').setValue(joiner.displayName)
    await wrapper.find('#join-role').setValue(RoomRole.Guest)
    await wrapper.find('form').trigger('submit')
    await settleAsyncWork()

    const member = await memberRepository.find(room.roomId, joiner.profileId)
    expect(member?.role).toBe(RoomRole.Guest)
  })

  it('shows session error toast when there is no active session profile', async () => {
    await seedActiveSessionProfile({ displayName: 'Transient Session User' })
    const { room } = await seedActiveHostRoom({ requireApproval: true })
    const session = useSessionStore()
    session.activeProfileId = null
    session.profiles = []
    const ui = useUiStore()

    const { wrapper } = await mountPage()
    await wrapper.find('#join-code').setValue(room.pairingCode)
    await wrapper.find('#join-name').setValue('No Session')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(ui.toasts.some((t) => t.message.includes('No active session'))).toBe(true)
  })

  it('normalizes lowercase pairing code and still joins matching room', async () => {
    const { room } = await seedActiveHostRoom({ requireApproval: true })
    const joiner = await seedActiveSessionProfile({ displayName: 'Lowercase Joiner' })
    const { wrapper } = await mountPage()

    await wrapper.find('#join-code').setValue(room.pairingCode.toLowerCase())
    await wrapper.find('#join-name').setValue(joiner.displayName)
    await wrapper.find('form').trigger('submit')
    await settleAsyncWork()

    const member = await memberRepository.find(room.roomId, joiner.profileId)
    expect(member?.memberId).toBe(joiner.profileId)
    expect(wrapper.text()).toContain('Awaiting Approval')
  })

  it('keeps room list unchanged while join request is pending', async () => {
    const { room } = await seedActiveHostRoom({ requireApproval: true })
    const joiner = await seedActiveSessionProfile({ displayName: 'Pending Joiner' })
    const initialRooms = await roomRepository.listAll()
    const { wrapper } = await mountPage()

    await wrapper.find('#join-code').setValue(room.pairingCode)
    await wrapper.find('#join-name').setValue(joiner.displayName)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const afterRooms = await roomRepository.listAll()
    expect(afterRooms.length).toBe(initialRooms.length)
  })
})

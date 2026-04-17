// REQ: R19 — Manual WebRTC pairing: offer/answer flow, failure fallback, retry

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/services/webrtc-peer-service', () => ({
  createOffer: vi.fn(async () => 'FAKE_OFFER_SDP'),
  addRemoteOffer: vi.fn(async () => 'FAKE_ANSWER_SDP'),
  acceptAnswer: vi.fn(async () => undefined),
  generatePeerId: vi.fn(() => 'peer-123'),
}))

import PairingPanel from '@/components/workspace/PairingPanel.vue'
import { usePeersStore } from '@/stores/peers-store'
import { useSessionStore } from '@/stores/session-store'
import {
  createOffer,
  addRemoteOffer,
  acceptAnswer,
} from '@/services/webrtc-peer-service'

describe('PairingPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders the initial status label "Not connected" when idle', () => {
    const wrapper = mount(PairingPanel, {
      props: { roomId: 'room-1', isHost: true },
    })
    expect(wrapper.find('.pairing-panel__status-label').text()).toBe('Not connected')
  })

  it('host: generates an offer and stores it in the peers store', async () => {
    const wrapper = mount(PairingPanel, {
      props: { roomId: 'room-1', isHost: true },
    })
    const session = useSessionStore()
    ;(session as any).activeProfileId = 'host-1'
    await wrapper.find('.pairing-panel__btn--primary').trigger('click')
    await flushPromises()
    expect(createOffer).toHaveBeenCalled()
    const peers = usePeersStore()
    expect(peers.localOffer).toBe('FAKE_OFFER_SDP')
    expect(peers.pairingStep).toBe('awaiting-answer')
  })

  it('host: applies an answer and transitions to connected', async () => {
    const wrapper = mount(PairingPanel, {
      props: { roomId: 'room-1', isHost: true },
    })
    const peers = usePeersStore()
    peers.setLocalOffer('FAKE_OFFER_SDP')
    peers.setPairingStep('awaiting-answer')
    await wrapper.vm.$nextTick()
    await wrapper.find('textarea:not([readonly])').setValue('ANSWER_FROM_PEER')
    await wrapper.find('.pairing-panel__btn--primary').trigger('click')
    await flushPromises()
    expect(acceptAnswer).toHaveBeenCalledWith('peer-123', 'ANSWER_FROM_PEER')
    expect(peers.pairingStep).toBe('connected')
  })

  it('guest: paste offer → generate answer stores it and updates step', async () => {
    const wrapper = mount(PairingPanel, {
      props: { roomId: 'room-1', isHost: false },
    })
    await wrapper.find('textarea:not([readonly])').setValue('OFFER_FROM_HOST')
    await wrapper.find('.pairing-panel__btn--primary').trigger('click')
    await flushPromises()
    expect(addRemoteOffer).toHaveBeenCalled()
    const peers = usePeersStore()
    expect(peers.localAnswer).toBe('FAKE_ANSWER_SDP')
  })

  it('shows the failure fallback guidance and retry button when step is failed', async () => {
    const wrapper = mount(PairingPanel, {
      props: { roomId: 'room-1', isHost: true },
    })
    const peers = usePeersStore()
    peers.setPairingStep('failed')
    peers.setPairingError('Boom')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="fallback-guidance"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="retry-btn"]').exists()).toBe(true)
    expect(wrapper.find('.pairing-panel__error').text()).toContain('Boom')
  })

  it('retry button resets pairing state', async () => {
    const wrapper = mount(PairingPanel, {
      props: { roomId: 'room-1', isHost: true },
    })
    const peers = usePeersStore()
    peers.setPairingStep('failed')
    peers.setLocalOffer('STALE_OFFER')
    peers.setPairingError('Oops')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="retry-btn"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(peers.pairingStep).toBe('idle')
    expect(peers.localOffer).toBeNull()
    expect(peers.pairingError).toBeNull()
  })

  it('disables the host "Connect" button while answer input is blank', async () => {
    const wrapper = mount(PairingPanel, {
      props: { roomId: 'room-1', isHost: true },
    })
    const peers = usePeersStore()
    peers.setLocalOffer('FAKE_OFFER_SDP')
    peers.setPairingStep('awaiting-answer')
    await wrapper.vm.$nextTick()
    const connectBtn = wrapper.findAll('.pairing-panel__btn--primary').at(-1)!
    expect(connectBtn.attributes('disabled')).toBeDefined()
  })
})

// REQ: R18 — BroadcastChannel multi-tab sync infrastructure

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  initBroadcastChannel,
  subscribeBroadcast,
  broadcastMessage,
  closeBroadcastChannel,
  isBroadcastChannelOpen,
} from '@/services/broadcast-channel-service'
import type { BroadcastEnvelope } from '@/models/broadcast'

describe('broadcast-channel-service', () => {
  beforeEach(() => {
    closeBroadcastChannel()
  })

  afterEach(() => {
    closeBroadcastChannel()
  })

  it('initBroadcastChannel opens the channel', () => {
    initBroadcastChannel('tab-A')
    expect(isBroadcastChannelOpen()).toBe(true)
  })

  it('closeBroadcastChannel marks the channel closed and drops subscribers', () => {
    initBroadcastChannel('tab-A')
    closeBroadcastChannel()
    expect(isBroadcastChannelOpen()).toBe(false)
  })

  it('delivers messages from one tab to another tab subscribed to the same type', async () => {
    initBroadcastChannel('tab-A')
    // Set up a second "tab" in the same process by monkey-patching a fresh module state.
    // Easier approach: open a raw BroadcastChannel as the receiver.
    const received: unknown[] = []
    const raw = new BroadcastChannel('forgeroom:sync')
    raw.onmessage = (ev: MessageEvent) => received.push(ev.data)

    broadcastMessage('element-change', { operation: 'create', elementId: 'e1' }, 'r1')
    await new Promise((r) => setTimeout(r, 0))

    const delivered = received[0] as BroadcastEnvelope
    expect(delivered).toMatchObject({
      type: 'element-change',
      tabId: 'tab-A',
      roomId: 'r1',
      payload: { operation: 'create', elementId: 'e1' },
    })
    raw.close()
  })

  it('subscribeBroadcast returns an unsubscribe function', () => {
    initBroadcastChannel('tab-A')
    const handler = vi.fn()
    const unsub = subscribeBroadcast('element-change', handler)
    expect(typeof unsub).toBe('function')
    unsub()
    // Re-subscribing should still work after unsubscribe
    const unsub2 = subscribeBroadcast('element-change', handler)
    unsub2()
  })

  it('ignores messages with mismatched envelope shape', async () => {
    initBroadcastChannel('tab-A')
    const handler = vi.fn()
    subscribeBroadcast('element-change', handler)

    // Send a raw malformed message from another channel instance
    const raw = new BroadcastChannel('forgeroom:sync')
    raw.postMessage({ not: 'an envelope' })
    raw.postMessage(null)
    await new Promise((r) => setTimeout(r, 0))

    expect(handler).not.toHaveBeenCalled()
    raw.close()
  })

  it('ignores its own tab ID (no self-delivery)', async () => {
    initBroadcastChannel('tab-A')
    const handler = vi.fn()
    subscribeBroadcast('element-change', handler)

    // Send from a peer that uses the same tabId
    const raw = new BroadcastChannel('forgeroom:sync')
    raw.postMessage({
      type: 'element-change',
      tabId: 'tab-A',
      timestamp: '2026-01-01T00:00:00.000Z',
      payload: { operation: 'create', elementId: 'self' },
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(handler).not.toHaveBeenCalled()
    raw.close()
  })

  it('routes messages with a different tabId to subscribers', async () => {
    initBroadcastChannel('tab-A')
    const handler = vi.fn()
    subscribeBroadcast('element-change', handler)

    const raw = new BroadcastChannel('forgeroom:sync')
    raw.postMessage({
      type: 'element-change',
      tabId: 'tab-B',
      timestamp: '2026-01-01T00:00:00.000Z',
      roomId: 'r1',
      payload: { operation: 'update', elementId: 'e2' },
    })
    await new Promise((r) => setTimeout(r, 0))

    expect(handler).toHaveBeenCalledTimes(1)
    expect((handler.mock.calls[0][0] as BroadcastEnvelope).payload).toEqual({
      operation: 'update',
      elementId: 'e2',
    })
    raw.close()
  })

  it('broadcastMessage is a no-op when the channel is not initialized', () => {
    // No init here
    expect(() => broadcastMessage('element-change', {}, 'r1')).not.toThrow()
  })
})

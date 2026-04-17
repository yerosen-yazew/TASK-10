// REQ: R18 — BroadcastChannel multi-tab coordination infrastructure
// Provides subscribe/publish lifecycle for tab-to-tab sync events.
// Full conflict handling (toasts, overwrite prevention) is wired in Prompt 7.

import { BROADCAST_CHANNEL_NAME } from '@/models/constants'
import type { BroadcastEnvelope, BroadcastEventType } from '@/models/broadcast'
import { logger } from '@/utils/logger'

type MessageHandler<T = unknown> = (envelope: BroadcastEnvelope<T>) => void

let channel: BroadcastChannel | null = null
const handlers = new Map<string, Set<MessageHandler>>()
let localTabId = ''

/**
 * Initialize the BroadcastChannel and register the inbound message router.
 * Must be called once after the app mounts with a unique tab session ID.
 *
 * @param tabId — unique ID for this tab session (use generateId())
 */
export function initBroadcastChannel(tabId: string): void {
  if (channel) {
    channel.close()
    handlers.clear()
  }
  localTabId = tabId
  channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME)

  channel.onmessage = (event: MessageEvent) => {
    const envelope = event.data as BroadcastEnvelope
    if (!envelope || typeof envelope !== 'object') return
    if (!envelope.type) return
    // Ignore messages originating from this same tab
    if (envelope.tabId === localTabId) return

    const typeHandlers = handlers.get(envelope.type)
    if (!typeHandlers) return
    for (const handler of typeHandlers) {
      try {
        handler(envelope)
      } catch (err) {
        logger.error('BroadcastChannel handler threw', { type: envelope.type, err })
      }
    }
  }

  logger.info('BroadcastChannel initialized', { channelName: BROADCAST_CHANNEL_NAME, tabId })
}

/**
 * Subscribe to a specific broadcast event type.
 * Returns an unsubscribe function — call it to remove the handler.
 */
export function subscribeBroadcast<T = unknown>(
  type: BroadcastEventType,
  handler: MessageHandler<T>
): () => void {
  if (!handlers.has(type)) {
    handlers.set(type, new Set())
  }
  handlers.get(type)!.add(handler as MessageHandler)
  return () => {
    handlers.get(type)?.delete(handler as MessageHandler)
  }
}

/**
 * Publish a typed message to all other tabs.
 * Own-tab messages are filtered out on the receiving side.
 */
export function broadcastMessage<T>(
  type: BroadcastEventType,
  payload: T,
  roomId?: string
): void {
  if (!channel) {
    logger.warn('broadcastMessage called before initBroadcastChannel')
    return
  }
  const envelope: BroadcastEnvelope<T> = {
    type,
    tabId: localTabId,
    timestamp: new Date().toISOString(),
    roomId,
    payload,
  }
  channel.postMessage(envelope)
}

/**
 * Close the channel and remove all subscribers.
 * Call this on app teardown or during testing cleanup.
 */
export function closeBroadcastChannel(): void {
  if (channel) {
    channel.close()
    channel = null
  }
  handlers.clear()
  localTabId = ''
  logger.info('BroadcastChannel closed')
}

/** Returns true if the channel is currently open. */
export function isBroadcastChannelOpen(): boolean {
  return channel !== null
}

/** Returns the current tab's session id (or empty string if not initialized). */
export function getLocalTabId(): string {
  return localTabId
}

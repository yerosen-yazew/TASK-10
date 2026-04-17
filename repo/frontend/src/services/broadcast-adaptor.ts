// REQ: R18 — BroadcastChannel multi-tab coordination wiring
// Subscribes to all broadcast event types and dispatches to the correct Pinia stores.
// Keeps adaptor lifecycle (attach/detach) separate from the channel infrastructure.

import {
  subscribeBroadcast,
  broadcastMessage,
} from './broadcast-channel-service'
import type {
  ElementChangePayload,
  ChatMessagePayload,
  MembershipChangePayload,
  ConflictNotifyPayload,
  SessionLockPayload,
  SnapshotCreatedPayload,
  RollbackAppliedPayload,
  PinChangePayload,
} from '@/models/broadcast'
import { logger } from '@/utils/logger'

/**
 * Attach BroadcastChannel subscriptions for a specific room.
 * All inbound events from other tabs are dispatched to Pinia stores.
 * Returns a cleanup function — call it when leaving the room or unmounting.
 *
 * Store imports are deferred (dynamic) to avoid circular dependency
 * between adaptors and store files at module-load time.
 */
export function attachRoomBroadcast(roomId: string): () => void {
  const unsubs: Array<() => void> = []

  // element-change → reload element store
  unsubs.push(
    subscribeBroadcast<ElementChangePayload>('element-change', async (envelope) => {
      if (envelope.roomId !== roomId) return
      const { useElementStore } = await import('@/stores/element-store')
      const store = useElementStore()
      await store.loadElements(roomId)
      logger.debug('BC: element-change received', { op: envelope.payload.operation })
    })
  )

  // chat-message → reload chat store
  unsubs.push(
    subscribeBroadcast<ChatMessagePayload>('chat-message', async (envelope) => {
      if (envelope.roomId !== roomId) return
      const { useChatStore } = await import('@/stores/chat-store')
      const store = useChatStore()
      await store.loadChat(roomId)
      logger.debug('BC: chat-message received', { op: envelope.payload.operation })
    })
  )

  // pin-change → reload chat store (pinned list refresh)
  unsubs.push(
    subscribeBroadcast<PinChangePayload>('pin-change', async (envelope) => {
      if (envelope.roomId !== roomId) return
      const { useChatStore } = await import('@/stores/chat-store')
      const store = useChatStore()
      await store.loadChat(roomId)
      logger.debug('BC: pin-change received', { op: envelope.payload.operation })
    })
  )

  // membership-change → refresh room members
  unsubs.push(
    subscribeBroadcast<MembershipChangePayload>('membership-change', async (envelope) => {
      if (envelope.roomId !== roomId) return
      const { useRoomStore } = await import('@/stores/room-store')
      const store = useRoomStore()
      await store.refreshMembers()
      logger.debug('BC: membership-change received', { op: envelope.payload.operation })
    })
  )

  // conflict-notify → show banner
  unsubs.push(
    subscribeBroadcast<ConflictNotifyPayload>('conflict-notify', async (envelope) => {
      if (envelope.roomId !== roomId) return
      const { useUiStore } = await import('@/stores/ui-store')
      const store = useUiStore()
      store.addBanner(
        `Conflict detected: ${envelope.payload.message}`,
        'warning',
        true
      )
      logger.warn('BC: conflict-notify received', { type: envelope.payload.conflictType })
    })
  )

  // session-lock → lock the session in all tabs
  unsubs.push(
    subscribeBroadcast<SessionLockPayload>('session-lock', async (envelope) => {
      if (envelope.payload.action === 'lock' || envelope.payload.action === 'sign-out') {
        const { useSessionStore } = await import('@/stores/session-store')
        const store = useSessionStore()
        if (envelope.payload.action === 'lock') {
          store.lock()
        } else {
          store.signOut()
        }
        logger.debug('BC: session-lock received', { action: envelope.payload.action })
      }
    })
  )

  // snapshot-created → refresh snapshot list
  unsubs.push(
    subscribeBroadcast<SnapshotCreatedPayload>('snapshot-created', async (envelope) => {
      if (envelope.roomId !== roomId) return
      const { useSnapshotStore } = await import('@/stores/snapshot-store')
      const store = useSnapshotStore()
      await store.refresh(roomId)
      logger.debug('BC: snapshot-created received', { snapshotId: envelope.payload.snapshotId })
    })
  )

  // rollback-applied → refresh snapshot list + toast
  unsubs.push(
    subscribeBroadcast<RollbackAppliedPayload>('rollback-applied', async (envelope) => {
      if (envelope.roomId !== roomId) return
      const { useSnapshotStore } = await import('@/stores/snapshot-store')
      const { useUiStore } = await import('@/stores/ui-store')
      const snapStore = useSnapshotStore()
      const uiStore = useUiStore()
      await snapStore.refresh(roomId)
      uiStore.toast.info('Another tab applied a rollback.')
      logger.debug('BC: rollback-applied received', { snapshotId: envelope.payload.snapshotId })
    })
  )

  return () => {
    for (const unsub of unsubs) unsub()
    logger.debug('BC: room broadcast detached', { roomId })
  }
}

/**
 * Broadcast an element change to other tabs.
 * Call after any local element mutation succeeds.
 */
export function broadcastElementChange(
  roomId: string,
  operation: 'create' | 'update' | 'delete',
  elementId: string
): void {
  broadcastMessage('element-change', { operation, elementId }, roomId)
}

/** Broadcast a chat message event to other tabs. */
export function broadcastChatMessage(
  roomId: string,
  operation: 'new' | 'delete',
  messageId: string
): void {
  broadcastMessage('chat-message', { operation, messageId }, roomId)
}

/** Broadcast a membership change to other tabs. */
export function broadcastMembershipChange(
  roomId: string,
  operation: 'request' | 'approve' | 'reject' | 'leave',
  memberId: string
): void {
  broadcastMessage('membership-change', { operation, memberId }, roomId)
}

/** Broadcast a pin change to other tabs. */
export function broadcastPinChange(
  roomId: string,
  operation: 'pin' | 'unpin',
  messageId: string
): void {
  broadcastMessage('pin-change', { operation, messageId }, roomId)
}

/** Broadcast a session lock to all tabs. */
export function broadcastSessionLock(
  profileId: string,
  action: 'lock' | 'unlock' | 'sign-out'
): void {
  broadcastMessage('session-lock', { action, profileId })
}

/**
 * Broadcast a conflict notification to all tabs.
 * Call when a write operation detects a concurrent collision (e.g., two tabs
 * trying to update the same element simultaneously).
 *
 * The conflict-notify handler in attachRoomBroadcast displays a banner to the
 * user in the other tabs, prompting them to reload or reconcile manually.
 */
export function broadcastConflictNotify(
  roomId: string,
  conflictType: 'element-overwrite' | 'pin-collision' | 'membership-race' | 'rollback-collision',
  resourceId: string,
  conflictingTabId: string,
  message: string
): void {
  broadcastMessage('conflict-notify', {
    conflictType,
    resourceId,
    conflictingTabId,
    message,
  }, roomId)
}

/** Broadcast a snapshot creation to other tabs. */
export function broadcastSnapshotCreated(
  roomId: string,
  snapshotId: string,
  sequenceNumber: number
): void {
  broadcastMessage('snapshot-created', { snapshotId, sequenceNumber }, roomId)
}

/** Broadcast a rollback completion to other tabs. */
export function broadcastRollbackApplied(
  roomId: string,
  snapshotId: string,
  initiatorId: string,
  resultingSnapshotId: string
): void {
  broadcastMessage('rollback-applied', { snapshotId, initiatorId, resultingSnapshotId }, roomId)
}

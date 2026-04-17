// REQ: R19 — WebRTC inbound message dispatch to Pinia stores
// Bridges CollabMessage payloads from remote peers to the correct store reload actions.
// Mirrors broadcast-adaptor but for WebRTC DataChannel messages.

import { onCollabMessage, sendCollabMessage } from './webrtc-peer-service'
import type {
  CollabMessage,
  ElementOpPayload,
  ChatOpPayload,
  CommentOpPayload,
  ApprovalOpPayload,
  SnapshotOpPayload,
  RollbackOpPayload,
} from '@/models/collaboration'
import { logger } from '@/utils/logger'

/**
 * Attach inbound WebRTC message handling for a specific room.
 * All CollabMessages received from any peer are dispatched to Pinia stores.
 * Returns a cleanup function — call it when leaving the room.
 */
export function attachWebRTCAdaptor(roomId: string): () => void {
  const unsub = onCollabMessage(async (peerId, msg) => {
    if (msg.roomId !== roomId) return

    try {
      switch (msg.type) {
        case 'element-op': {
          const { applyElementMutation } = await import('@/engine/element-engine')
          const { useElementStore } = await import('@/stores/element-store')
          const payload = msg.payload as ElementOpPayload
          await applyElementMutation(roomId, payload)
          await useElementStore().loadElements(roomId)
          logger.debug('WebRTC: element-op applied', { peerId, op: payload.operation })
          break
        }

        case 'chat-op': {
          const { applyChatMutation } = await import('@/engine/chat-engine')
          const { useChatStore } = await import('@/stores/chat-store')
          const payload = msg.payload as ChatOpPayload
          await applyChatMutation(roomId, payload)
          await useChatStore().loadChat(roomId)
          logger.debug('WebRTC: chat-op applied', { peerId, op: payload.operation })
          break
        }

        case 'comment-op': {
          const { applyCommentMutation } = await import('@/engine/comment-engine')
          const { useCommentStore } = await import('@/stores/comment-store')
          const payload = msg.payload as CommentOpPayload
          await applyCommentMutation(roomId, payload)
          await useCommentStore().loadThreads(roomId)
          if (payload.threadId) {
            await useCommentStore().loadComments(payload.threadId)
          }
          logger.debug('WebRTC: comment-op applied', { peerId, op: payload.operation })
          break
        }

        case 'presence-op': {
          // Presence is in-memory — handled by the presence engine directly
          // The payload carries PresenceState; apply via presenceEngine.setPresence
          const { usePresenceStore } = await import('@/stores/presence-store')
          const store = usePresenceStore()
          const ps = msg.payload as import('@/models/presence').PresenceState
          if (ps?.memberId) {
            const { setPresence } = await import('@/engine/presence-engine')
            setPresence(ps)
            store.attach(roomId)
          }
          break
        }

        case 'approval-op': {
          const { applyMembershipMutation } = await import('@/engine/membership-engine')
          const { useRoomStore } = await import('@/stores/room-store')
          const payload = msg.payload as ApprovalOpPayload
          await applyMembershipMutation(roomId, payload)
          await useRoomStore().refreshMembers()
          logger.debug('WebRTC: approval-op applied', { peerId, op: payload.operation })
          break
        }

        case 'activity-op': {
          const { useActivityStore } = await import('@/stores/activity-store')
          await useActivityStore().refresh(roomId)
          logger.debug('WebRTC: activity-op applied', { peerId })
          break
        }

        case 'snapshot-op': {
          const { snapshotRepository } = await import('@/services/snapshot-repository')
          const { useSnapshotStore } = await import('@/stores/snapshot-store')
          const { useUiStore } = await import('@/stores/ui-store')
          const payload = msg.payload as SnapshotOpPayload
          if (payload.snapshot) {
            await snapshotRepository.put(payload.snapshot)
          }
          await useSnapshotStore().refresh(roomId)
          useUiStore().toast.info('A peer created a snapshot.')
          logger.debug('WebRTC: snapshot-op applied', { peerId, snapshotId: payload.snapshotId })
          break
        }

        case 'rollback-op': {
          const { snapshotRepository } = await import('@/services/snapshot-repository')
          const { useSnapshotStore } = await import('@/stores/snapshot-store')
          const { useUiStore } = await import('@/stores/ui-store')
          const payload = msg.payload as RollbackOpPayload
          if (payload.snapshot) {
            await snapshotRepository.put(payload.snapshot)
          }
          await useSnapshotStore().refresh(roomId)
          useUiStore().toast.info('A peer applied a rollback.')
          logger.debug('WebRTC: rollback-op applied', { peerId, snapshotId: payload.snapshotId })
          break
        }

        case 'conflict-op': {
          const { useUiStore } = await import('@/stores/ui-store')
          const payload = msg.payload as { message?: string }
          useUiStore().addBanner(
            `Peer conflict detected: ${payload?.message ?? 'unknown conflict'}`,
            'warning',
            true
          )
          logger.warn('WebRTC: conflict-op received', { peerId })
          break
        }

        case 'sync-request': {
          // Respond with a full element list so the new peer can catch up
          const { listElements } = await import('@/engine/element-engine')
          const elements = await listElements(roomId)
          const response: CollabMessage = {
            type: 'sync-response',
            senderId: msg.roomId,
            timestamp: new Date().toISOString(),
            seqNum: 0,
            roomId,
            payload: { elements },
          }
          sendCollabMessage(peerId, response)
          logger.debug('WebRTC: sync-request handled', { peerId })
          break
        }

        case 'sync-response': {
          // Reload elements from local store (the response payload is guidance only;
          // definitive state comes from IndexedDB written by the host-side engine)
          const { useElementStore } = await import('@/stores/element-store')
          await useElementStore().loadElements(roomId)
          logger.debug('WebRTC: sync-response handled', { peerId })
          break
        }

        default:
          logger.warn('WebRTC: unknown message type', { type: msg.type, peerId })
      }
    } catch (err) {
      logger.error('WebRTC: adaptor dispatch error', { type: msg.type, peerId, err })
    }
  })

  return () => {
    unsub()
    logger.info('WebRTC adaptor detached', { roomId })
  }
}

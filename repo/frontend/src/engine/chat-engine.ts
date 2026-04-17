// REQ: R8 — 5,000 message retention (oldest trimmed), 3 pinned max

import { MAX_CHAT_MESSAGES_RETAINED } from '@/models/constants'
import type { ValidationResult } from '@/models/validation'
import { invalidResult, validResult } from '@/models/validation'
import { validatePinnedCount } from '@/validators/chat-validators'
import type { ChatMessage, PinnedMessage } from '@/models/chat'
import { chatMessageRepository } from '@/services/chat-message-repository'
import { pinnedMessageRepository } from '@/services/pinned-message-repository'
import { generateId } from '@/utils/id-generator'
import { nowISO } from '@/utils/date-utils'
import { emitActivity, type ActivityActor } from './activity-engine'
import { ActivityEventType } from '@/models/activity'
import type { ChatOpPayload } from '@/models/collaboration'

export interface SendMessageInput {
  roomId: string
  authorId: string
  authorDisplayName: string
  text: string
  mentions?: Array<{ memberId: string; displayName: string }>
}

export interface ChatResult {
  validation: ValidationResult
  message?: ChatMessage
}

export interface PinResult {
  validation: ValidationResult
  pinned?: PinnedMessage
}

/** Send a chat message and trim to the 5,000 retention cap. */
export async function sendMessage(input: SendMessageInput): Promise<ChatResult> {
  const now = nowISO()
  const message: ChatMessage = {
    messageId: generateId(),
    roomId: input.roomId,
    authorId: input.authorId,
    authorDisplayName: input.authorDisplayName,
    text: input.text,
    mentions: input.mentions ?? [],
    createdAt: now,
    isDeleted: false,
  }
  await chatMessageRepository.put(message)
  await chatMessageRepository.deleteOldestExcess(input.roomId, MAX_CHAT_MESSAGES_RETAINED)
  return { validation: validResult(), message }
}

/** List the most recent chat messages (ascending by createdAt). */
export async function listRecent(roomId: string): Promise<ChatMessage[]> {
  return chatMessageRepository.listByRoom(roomId)
}

/** Pin a message. Enforces the 3-pin cap per room. */
export async function pinMessage(
  roomId: string,
  messageId: string,
  actor: ActivityActor
): Promise<PinResult> {
  const existing = await pinnedMessageRepository.find(roomId, messageId)
  if (existing) {
    return {
      validation: invalidResult(
        'messageId',
        'Message is already pinned.',
        'duplicate',
        messageId
      ),
    }
  }
  const count = await pinnedMessageRepository.countByRoom(roomId)
  const cap = validatePinnedCount(count)
  if (!cap.valid) return { validation: cap }

  const pinned: PinnedMessage = {
    roomId,
    messageId,
    pinnedBy: actor.memberId,
    pinnedAt: nowISO(),
  }
  await pinnedMessageRepository.put(pinned)
  await emitActivity(
    roomId,
    ActivityEventType.MessagePinned,
    actor,
    `Pinned a message`,
    { targetId: messageId, targetType: 'message' }
  )
  return { validation: validResult(), pinned }
}

/** Unpin a message. */
export async function unpinMessage(
  roomId: string,
  messageId: string,
  actor: ActivityActor
): Promise<ValidationResult> {
  const existing = await pinnedMessageRepository.find(roomId, messageId)
  if (!existing) {
    return invalidResult('messageId', 'Message is not pinned.', 'not_found', messageId)
  }
  await pinnedMessageRepository.delete([roomId, messageId])
  await emitActivity(
    roomId,
    ActivityEventType.MessageUnpinned,
    actor,
    `Unpinned a message`,
    { targetId: messageId, targetType: 'message' }
  )
  return validResult()
}

/** List currently pinned messages in a room. */
export async function listPinned(roomId: string): Promise<PinnedMessage[]> {
  return pinnedMessageRepository.listByRoom(roomId)
}

/**
 * Apply an inbound WebRTC chat mutation payload to local IndexedDB.
 * This path intentionally avoids generating local activity records.
 */
export async function applyChatMutation(
  roomId: string,
  payload: ChatOpPayload
): Promise<ValidationResult> {
  if (!payload.messageId) {
    return invalidResult('messageId', 'Missing message id in collaboration payload.', 'required')
  }

  switch (payload.operation) {
    case 'new': {
      if (!payload.message) {
        return invalidResult('message', 'Missing chat message payload.', 'required')
      }
      if (payload.message.roomId !== roomId) {
        return invalidResult('roomId', 'Chat payload room mismatch.', 'invalid')
      }
      await chatMessageRepository.put(payload.message)
      await chatMessageRepository.deleteOldestExcess(roomId, MAX_CHAT_MESSAGES_RETAINED)
      return validResult()
    }

    case 'delete': {
      if (payload.message) {
        await chatMessageRepository.put({ ...payload.message, isDeleted: true })
      } else {
        const existing = await chatMessageRepository.getById(payload.messageId)
        if (existing) {
          await chatMessageRepository.put({ ...existing, isDeleted: true })
        }
      }
      return validResult()
    }

    case 'pin': {
      if (payload.pinned) {
        if (payload.pinned.roomId !== roomId) {
          return invalidResult('roomId', 'Pinned payload room mismatch.', 'invalid')
        }
        await pinnedMessageRepository.put(payload.pinned)
      } else {
        await pinnedMessageRepository.put({
          roomId,
          messageId: payload.messageId,
          pinnedBy: 'remote-peer',
          pinnedAt: nowISO(),
        })
      }
      return validResult()
    }

    case 'unpin': {
      await pinnedMessageRepository.delete([roomId, payload.messageId])
      return validResult()
    }

    default:
      return invalidResult('operation', 'Unsupported chat operation.', 'invalid')
  }
}

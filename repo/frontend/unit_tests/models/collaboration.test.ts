// REQ: collaboration model pairing and message contracts

import { describe, expect, it } from 'vitest'
import { PAIRING_PROTOCOL_VERSION } from '@/models/constants'
import type {
  PairingOffer,
  PairingAnswer,
  CollabMessage,
  ConflictRecord,
  ApprovalOpPayload,
} from '@/models/collaboration'

describe('collaboration model', () => {
  it('accepts pairing offer and answer fixtures', () => {
    const offer: PairingOffer = {
      version: PAIRING_PROTOCOL_VERSION,
      type: 'offer',
      roomId: 'room-1',
      peerId: 'peer-host',
      displayName: 'Host',
      timestamp: '2026-01-01T00:00:00.000Z',
      verificationCode: 'FORGE-8A3F',
      sdp: 'offer-sdp',
      iceCandidates: ['cand-1'],
      checksum: 'abc123',
    }

    const answer: PairingAnswer = {
      version: PAIRING_PROTOCOL_VERSION,
      type: 'answer',
      roomId: 'room-1',
      peerId: 'peer-joiner',
      displayName: 'Joiner',
      timestamp: '2026-01-01T00:00:10.000Z',
      verificationCode: 'FORGE-8A3F',
      sdp: 'answer-sdp',
      iceCandidates: ['cand-2'],
      checksum: 'def456',
    }

    expect(offer.version).toBe(PAIRING_PROTOCOL_VERSION)
    expect(answer.type).toBe('answer')
    expect(answer.verificationCode).toBe(offer.verificationCode)
  })

  it('accepts collab message and conflict fixtures', () => {
    const payload: ApprovalOpPayload = {
      operation: 'approve',
      memberId: 'member-1',
    }

    const message: CollabMessage<ApprovalOpPayload> = {
      type: 'approval-op',
      senderId: 'host-1',
      timestamp: '2026-01-01T00:02:00.000Z',
      seqNum: 1,
      roomId: 'room-1',
      payload,
    }

    const conflict: ConflictRecord = {
      conflictId: 'c1',
      roomId: 'room-1',
      conflictType: 'membership-race',
      resourceId: 'member-1',
      sourceTabOrPeerId: 'peer-x',
      detectedAt: '2026-01-01T00:03:00.000Z',
      resolved: false,
    }

    expect(message.type).toBe('approval-op')
    expect(message.payload.operation).toBe('approve')
    expect(conflict.resolved).toBe(false)
  })
})

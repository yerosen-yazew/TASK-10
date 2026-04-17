// REQ: R18/R19 — collab-publisher fans every write signal to BroadcastChannel + WebRTC

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBroadcastElementChange = vi.fn()
const mockBroadcastChatMessage = vi.fn()
const mockBroadcastPinChange = vi.fn()
const mockBroadcastMembershipChange = vi.fn()
const mockBroadcastSnapshotCreated = vi.fn()
const mockBroadcastRollbackApplied = vi.fn()
const mockBroadcastConflictNotify = vi.fn()

vi.mock('@/services/broadcast-adaptor', () => ({
  broadcastElementChange: (...a: any[]) => mockBroadcastElementChange(...a),
  broadcastChatMessage: (...a: any[]) => mockBroadcastChatMessage(...a),
  broadcastPinChange: (...a: any[]) => mockBroadcastPinChange(...a),
  broadcastMembershipChange: (...a: any[]) => mockBroadcastMembershipChange(...a),
  broadcastSnapshotCreated: (...a: any[]) => mockBroadcastSnapshotCreated(...a),
  broadcastRollbackApplied: (...a: any[]) => mockBroadcastRollbackApplied(...a),
  broadcastConflictNotify: (...a: any[]) => mockBroadcastConflictNotify(...a),
}))

const mockBroadcastCollabMessage = vi.fn()
vi.mock('@/services/webrtc-peer-service', () => ({
  broadcastCollabMessage: (...a: any[]) => mockBroadcastCollabMessage(...a),
}))

import {
  publishElement,
  publishChat,
  publishPin,
  publishComment,
  publishMembership,
  publishSnapshot,
  publishRollback,
  publishConflict,
  publishPresence,
  __resetSeqForTests,
} from '@/services/collab-publisher'

describe('collab-publisher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetSeqForTests()
  })

  describe('publishElement', () => {
    it('broadcasts element-change and sends WebRTC element-op', () => {
      publishElement('room-1', 'create', 'el-1', 'member-1')
      expect(mockBroadcastElementChange).toHaveBeenCalledWith('room-1', 'create', 'el-1')
      expect(mockBroadcastCollabMessage).toHaveBeenCalledOnce()
      const msg = mockBroadcastCollabMessage.mock.calls[0][0]
      expect(msg.type).toBe('element-op')
      expect(msg.roomId).toBe('room-1')
      expect(msg.senderId).toBe('member-1')
      expect(msg.payload).toMatchObject({ operation: 'create', elementId: 'el-1' })
      expect(msg.seqNum).toBe(1)
      expect(typeof msg.timestamp).toBe('string')
    })
  })

  describe('publishChat', () => {
    it('broadcasts chat-message and sends WebRTC chat-op', () => {
      publishChat('room-1', 'new', 'msg-1', 'member-1')
      expect(mockBroadcastChatMessage).toHaveBeenCalledWith('room-1', 'new', 'msg-1')
      const msg = mockBroadcastCollabMessage.mock.calls[0][0]
      expect(msg.type).toBe('chat-op')
      expect(msg.payload).toMatchObject({ operation: 'new', messageId: 'msg-1' })
    })
  })

  describe('publishPin', () => {
    it('broadcasts pin-change and sends WebRTC chat-op for pin', () => {
      publishPin('room-1', 'pin', 'msg-1', 'member-1')
      expect(mockBroadcastPinChange).toHaveBeenCalledWith('room-1', 'pin', 'msg-1')
      const msg = mockBroadcastCollabMessage.mock.calls[0][0]
      expect(msg.type).toBe('chat-op')
      expect(msg.payload.operation).toBe('pin')
    })
  })

  describe('publishComment', () => {
    it('sends WebRTC comment-op with thread/comment context', () => {
      publishComment('room-1', 'append-comment', 'thread-1', 'el-1', 'member-1')
      const msg = mockBroadcastCollabMessage.mock.calls[0][0]
      expect(msg.type).toBe('comment-op')
      expect(msg.payload).toMatchObject({
        operation: 'append-comment',
        threadId: 'thread-1',
        elementId: 'el-1',
      })
    })
  })

  describe('publishMembership', () => {
    it('broadcasts membership-change and sends WebRTC approval-op', () => {
      publishMembership('room-1', 'approve', 'member-2', 'host-1')
      expect(mockBroadcastMembershipChange).toHaveBeenCalledWith('room-1', 'approve', 'member-2')
      const msg = mockBroadcastCollabMessage.mock.calls[0][0]
      expect(msg.type).toBe('approval-op')
      expect(msg.payload).toMatchObject({ operation: 'approve', memberId: 'member-2' })
    })
  })

  describe('publishSnapshot', () => {
    it('broadcasts snapshot-created and sends WebRTC snapshot-op', () => {
      publishSnapshot('room-1', 'snap-1', 5, 'member-1')
      expect(mockBroadcastSnapshotCreated).toHaveBeenCalledWith('room-1', 'snap-1', 5)
      const msg = mockBroadcastCollabMessage.mock.calls[0][0]
      expect(msg.type).toBe('snapshot-op')
      expect(msg.payload.operation).toBe('snapshot-created')
      expect(msg.payload.snapshotId).toBe('snap-1')
      expect(msg.payload.sequenceNumber).toBe(5)
    })
  })

  describe('publishRollback', () => {
    it('broadcasts rollback-applied and sends WebRTC rollback-op', () => {
      publishRollback('room-1', 'snap-1', 'member-1', 'snap-result')
      expect(mockBroadcastRollbackApplied).toHaveBeenCalledWith(
        'room-1',
        'snap-1',
        'member-1',
        'snap-result'
      )
      const msg = mockBroadcastCollabMessage.mock.calls[0][0]
      expect(msg.type).toBe('rollback-op')
      expect(msg.payload.operation).toBe('rollback-applied')
      expect(msg.payload.resultingSnapshotId).toBe('snap-result')
    })
  })

  describe('publishConflict', () => {
    it('broadcasts conflict-notify and sends WebRTC conflict-op', () => {
      publishConflict('room-1', 'element-overwrite', 'el-1', 'tab-2', 'Conflict!', 'member-1')
      expect(mockBroadcastConflictNotify).toHaveBeenCalledWith(
        'room-1',
        'element-overwrite',
        'el-1',
        'tab-2',
        'Conflict!'
      )
      const msg = mockBroadcastCollabMessage.mock.calls[0][0]
      expect(msg.type).toBe('conflict-op')
      expect(msg.payload.conflictType).toBe('element-overwrite')
    })
  })

  describe('publishPresence', () => {
    it('sends a WebRTC presence-op carrying the cursor and member identity (no BroadcastChannel fan-out)', () => {
      publishPresence(
        'room-1',
        'member-1',
        { x: 10, y: 20, timestamp: 1234 },
        'Alice',
        '#ff0000',
      )
      // No BC helper should have been called — cursor presence is LAN-only
      expect(mockBroadcastElementChange).not.toHaveBeenCalled()
      expect(mockBroadcastChatMessage).not.toHaveBeenCalled()
      expect(mockBroadcastMembershipChange).not.toHaveBeenCalled()
      expect(mockBroadcastCollabMessage).toHaveBeenCalledOnce()
      const msg = mockBroadcastCollabMessage.mock.calls[0][0]
      expect(msg.type).toBe('presence-op')
      expect(msg.roomId).toBe('room-1')
      expect(msg.senderId).toBe('member-1')
      expect(msg.payload).toMatchObject({
        memberId: 'member-1',
        displayName: 'Alice',
        avatarColor: '#ff0000',
        isOnline: true,
        cursor: { x: 10, y: 20, timestamp: 1234 },
      })
    })
  })

  describe('sequence numbering', () => {
    it('seqNum is monotonically increasing across calls', () => {
      publishElement('room-1', 'create', 'el-1', 'm')
      publishChat('room-1', 'new', 'msg-1', 'm')
      publishPin('room-1', 'pin', 'msg-1', 'm')
      const seqs = mockBroadcastCollabMessage.mock.calls.map((c) => c[0].seqNum)
      expect(seqs).toEqual([1, 2, 3])
    })
  })
})

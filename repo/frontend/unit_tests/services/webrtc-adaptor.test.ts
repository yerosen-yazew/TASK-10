// REQ: R19 — WebRTC inbound message dispatch routes to the correct Pinia store

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CollabMessage } from '@/models/collaboration'

let capturedHandler: ((peerId: string, msg: CollabMessage) => void) | null = null
let unsubCalled = false

vi.mock('@/services/webrtc-peer-service', () => ({
  onCollabMessage: (h: any) => {
    capturedHandler = h
    return () => {
      unsubCalled = true
    }
  },
  sendCollabMessage: vi.fn(),
}))

const loadElements = vi.fn().mockResolvedValue(undefined)
const applyElementMutation = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/element-store', () => ({
  useElementStore: () => ({ loadElements }),
}))

const loadChat = vi.fn().mockResolvedValue(undefined)
const applyChatMutation = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/chat-store', () => ({
  useChatStore: () => ({ loadChat }),
}))

const loadThreads = vi.fn().mockResolvedValue(undefined)
const loadComments = vi.fn().mockResolvedValue(undefined)
const applyCommentMutation = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/comment-store', () => ({
  useCommentStore: () => ({ loadThreads, loadComments }),
}))

const presenceAttach = vi.fn()
vi.mock('@/stores/presence-store', () => ({
  usePresenceStore: () => ({ attach: presenceAttach }),
}))

const setPresence = vi.fn()
vi.mock('@/engine/presence-engine', () => ({
  setPresence,
}))

const refreshMembers = vi.fn().mockResolvedValue(undefined)
const applyMembershipMutation = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/room-store', () => ({
  useRoomStore: () => ({ refreshMembers }),
}))

const activityRefresh = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/activity-store', () => ({
  useActivityStore: () => ({ refresh: activityRefresh }),
}))

const snapshotRefresh = vi.fn().mockResolvedValue(undefined)
vi.mock('@/stores/snapshot-store', () => ({
  useSnapshotStore: () => ({ refresh: snapshotRefresh }),
}))

const snapshotPut = vi.fn().mockResolvedValue(undefined)
vi.mock('@/services/snapshot-repository', () => ({
  snapshotRepository: { put: snapshotPut },
}))

const toastInfo = vi.fn()
const addBanner = vi.fn()
vi.mock('@/stores/ui-store', () => ({
  useUiStore: () => ({
    toast: { info: toastInfo },
    addBanner,
  }),
}))

const listElements = vi.fn().mockResolvedValue([])
vi.mock('@/engine/element-engine', () => ({
  listElements,
  applyElementMutation,
}))

vi.mock('@/engine/chat-engine', () => ({
  applyChatMutation,
}))

vi.mock('@/engine/comment-engine', () => ({
  applyCommentMutation,
}))

vi.mock('@/engine/membership-engine', () => ({
  applyMembershipMutation,
}))

const loggerWarn = vi.fn()
const loggerInfo = vi.fn()
const loggerError = vi.fn()
const loggerDebug = vi.fn()
vi.mock('@/utils/logger', () => ({
  logger: { warn: loggerWarn, info: loggerInfo, error: loggerError, debug: loggerDebug },
}))

async function makeMsg<T>(
  type: string,
  roomId: string,
  payload: T,
): Promise<CollabMessage> {
  return {
    type: type as any,
    senderId: 'peer',
    timestamp: '2026-01-01T00:00:00.000Z',
    seqNum: 1,
    roomId,
    payload,
  } as CollabMessage
}

describe('webrtc-adaptor', () => {
  beforeEach(() => {
    capturedHandler = null
    unsubCalled = false
    vi.clearAllMocks()
  })

  it('attachWebRTCAdaptor registers a handler and returns a cleanup function', async () => {
    const { attachWebRTCAdaptor } = await import('@/services/webrtc-adaptor')
    const cleanup = attachWebRTCAdaptor('r1')
    expect(capturedHandler).not.toBeNull()
    cleanup()
    expect(unsubCalled).toBe(true)
  })

  it('ignores messages whose roomId does not match', async () => {
    const { attachWebRTCAdaptor } = await import('@/services/webrtc-adaptor')
    attachWebRTCAdaptor('r1')
    await capturedHandler!('peer', await makeMsg('element-op', 'OTHER', {}))
    expect(loadElements).not.toHaveBeenCalled()
  })

  it('element-op dispatches to elementStore.loadElements', async () => {
    const { attachWebRTCAdaptor } = await import('@/services/webrtc-adaptor')
    attachWebRTCAdaptor('r1')
    const payload = {
      operation: 'update',
      elementId: 'el-1',
      element: { elementId: 'el-1', roomId: 'r1', type: 'sticky-note' },
    }
    await capturedHandler!('peer', await makeMsg('element-op', 'r1', payload))
    expect(applyElementMutation).toHaveBeenCalledWith('r1', payload)
    expect(loadElements).toHaveBeenCalledWith('r1')
  })

  it('chat-op dispatches to chatStore.loadChat', async () => {
    const { attachWebRTCAdaptor } = await import('@/services/webrtc-adaptor')
    attachWebRTCAdaptor('r1')
    const payload = {
      operation: 'new',
      messageId: 'm1',
      message: { messageId: 'm1', roomId: 'r1', text: 'hello', isDeleted: false },
    }
    await capturedHandler!('peer', await makeMsg('chat-op', 'r1', payload))
    expect(applyChatMutation).toHaveBeenCalledWith('r1', payload)
    expect(loadChat).toHaveBeenCalledWith('r1')
  })

  it('comment-op applies mutation and refreshes thread + comments', async () => {
    const { attachWebRTCAdaptor } = await import('@/services/webrtc-adaptor')
    attachWebRTCAdaptor('r1')
    const payload = {
      operation: 'append-comment',
      threadId: 't1',
      elementId: 'el-1',
      comment: { commentId: 'c1', threadId: 't1', roomId: 'r1', text: 'hi' },
    }
    await capturedHandler!('peer', await makeMsg('comment-op', 'r1', payload))
    expect(applyCommentMutation).toHaveBeenCalledWith('r1', payload)
    expect(loadThreads).toHaveBeenCalledWith('r1')
    expect(loadComments).toHaveBeenCalledWith('t1')
  })

  it('presence-op applies setPresence and attaches the store', async () => {
    const { attachWebRTCAdaptor } = await import('@/services/webrtc-adaptor')
    attachWebRTCAdaptor('r1')
    await capturedHandler!(
      'peer',
      await makeMsg('presence-op', 'r1', {
        memberId: 'm1',
        roomId: 'r1',
        isActive: true,
      }),
    )
    expect(setPresence).toHaveBeenCalled()
    expect(presenceAttach).toHaveBeenCalledWith('r1')
  })

  it('approval-op dispatches to roomStore.refreshMembers', async () => {
    const { attachWebRTCAdaptor } = await import('@/services/webrtc-adaptor')
    attachWebRTCAdaptor('r1')
    const payload = {
      operation: 'approve',
      memberId: 'm2',
      member: { roomId: 'r1', memberId: 'm2', state: 'active' },
    }
    await capturedHandler!('peer', await makeMsg('approval-op', 'r1', payload))
    expect(applyMembershipMutation).toHaveBeenCalledWith('r1', payload)
    expect(refreshMembers).toHaveBeenCalled()
  })

  it('activity-op dispatches to activityStore.refresh', async () => {
    const { attachWebRTCAdaptor } = await import('@/services/webrtc-adaptor')
    attachWebRTCAdaptor('r1')
    await capturedHandler!('peer', await makeMsg('activity-op', 'r1', {}))
    expect(activityRefresh).toHaveBeenCalledWith('r1')
  })

  it('snapshot-op refreshes snapshots and shows snapshot toast', async () => {
    const { attachWebRTCAdaptor } = await import('@/services/webrtc-adaptor')
    attachWebRTCAdaptor('r1')
    await capturedHandler!(
      'peer',
      await makeMsg('snapshot-op', 'r1', {
        operation: 'snapshot-created',
        snapshotId: 's1',
        sequenceNumber: 1,
        snapshot: { snapshotId: 's1', roomId: 'r1' },
      })
    )
    expect(snapshotPut).toHaveBeenCalled()
    expect(snapshotRefresh).toHaveBeenCalledWith('r1')
    expect(toastInfo).toHaveBeenCalledWith('A peer created a snapshot.')
  })

  it('rollback-op refreshes snapshots and shows rollback toast', async () => {
    const { attachWebRTCAdaptor } = await import('@/services/webrtc-adaptor')
    attachWebRTCAdaptor('r1')
    await capturedHandler!(
      'peer',
      await makeMsg('rollback-op', 'r1', {
        operation: 'rollback-applied',
        snapshotId: 's1',
        resultingSnapshotId: 's2',
        initiatorId: 'm1',
      })
    )
    expect(snapshotRefresh).toHaveBeenCalledWith('r1')
    expect(toastInfo).toHaveBeenCalledWith('A peer applied a rollback.')
  })

  it('conflict-op surfaces a warning banner through uiStore.addBanner', async () => {
    const { attachWebRTCAdaptor } = await import('@/services/webrtc-adaptor')
    attachWebRTCAdaptor('r1')
    await capturedHandler!(
      'peer',
      await makeMsg('conflict-op', 'r1', { message: 'pin collision' }),
    )
    expect(addBanner).toHaveBeenCalled()
    const [msg, severity] = addBanner.mock.calls[0]
    expect(String(msg)).toContain('pin collision')
    expect(severity).toBe('warning')
  })

  it('logs a warning for an unknown message type', async () => {
    const { attachWebRTCAdaptor } = await import('@/services/webrtc-adaptor')
    attachWebRTCAdaptor('r1')
    await capturedHandler!('peer', await makeMsg('mystery-op' as any, 'r1', {}))
    expect(loggerWarn).toHaveBeenCalled()
  })
})

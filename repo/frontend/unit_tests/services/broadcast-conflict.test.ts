// REQ: R18 — BroadcastChannel conflict detection and notification helpers

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBroadcastMessage = vi.fn()

vi.mock('@/services/broadcast-channel-service', () => ({
  subscribeBroadcast: vi.fn(() => () => {}),
  broadcastMessage: mockBroadcastMessage,
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

describe('broadcast-adaptor — conflict helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('broadcastConflictNotify sends conflict-notify message', async () => {
    const { broadcastConflictNotify } = await import('@/services/broadcast-adaptor')
    broadcastConflictNotify('room-1', 'element-overwrite', 'el-1', 'tab-2', 'Element was overwritten.')
    expect(mockBroadcastMessage).toHaveBeenCalledWith(
      'conflict-notify',
      expect.objectContaining({
        conflictType: 'element-overwrite',
        resourceId: 'el-1',
        conflictingTabId: 'tab-2',
        message: 'Element was overwritten.',
      }),
      'room-1'
    )
  })

  it('broadcastConflictNotify supports pin-collision type', async () => {
    const { broadcastConflictNotify } = await import('@/services/broadcast-adaptor')
    broadcastConflictNotify('room-1', 'pin-collision', 'msg-1', 'tab-3', 'Pin conflict.')
    expect(mockBroadcastMessage).toHaveBeenCalledWith(
      'conflict-notify',
      expect.objectContaining({ conflictType: 'pin-collision' }),
      'room-1'
    )
  })

  it('broadcastConflictNotify supports rollback-collision type', async () => {
    const { broadcastConflictNotify } = await import('@/services/broadcast-adaptor')
    broadcastConflictNotify('room-1', 'rollback-collision', 'snap-1', 'tab-4', 'Rollback collision.')
    expect(mockBroadcastMessage).toHaveBeenCalledWith(
      'conflict-notify',
      expect.objectContaining({ conflictType: 'rollback-collision' }),
      'room-1'
    )
  })

  it('broadcastSnapshotCreated sends snapshot-created message', async () => {
    const { broadcastSnapshotCreated } = await import('@/services/broadcast-adaptor')
    broadcastSnapshotCreated('room-1', 'snap-1', 3)
    expect(mockBroadcastMessage).toHaveBeenCalledWith(
      'snapshot-created',
      expect.objectContaining({ snapshotId: 'snap-1', sequenceNumber: 3 }),
      'room-1'
    )
  })

  it('broadcastRollbackApplied sends rollback-applied message', async () => {
    const { broadcastRollbackApplied } = await import('@/services/broadcast-adaptor')
    broadcastRollbackApplied('room-1', 'snap-1', 'member-1', 'snap-2')
    expect(mockBroadcastMessage).toHaveBeenCalledWith(
      'rollback-applied',
      expect.objectContaining({
        snapshotId: 'snap-1',
        initiatorId: 'member-1',
        resultingSnapshotId: 'snap-2',
      }),
      'room-1'
    )
  })

  it('broadcastElementChange sends element-change message', async () => {
    const { broadcastElementChange } = await import('@/services/broadcast-adaptor')
    broadcastElementChange('room-1', 'create', 'el-new')
    expect(mockBroadcastMessage).toHaveBeenCalledWith(
      'element-change',
      expect.objectContaining({ operation: 'create', elementId: 'el-new' }),
      'room-1'
    )
  })

  it('broadcastMembershipChange sends membership-change message', async () => {
    const { broadcastMembershipChange } = await import('@/services/broadcast-adaptor')
    broadcastMembershipChange('room-1', 'approve', 'member-5')
    expect(mockBroadcastMessage).toHaveBeenCalledWith(
      'membership-change',
      expect.objectContaining({ operation: 'approve', memberId: 'member-5' }),
      'room-1'
    )
  })
})

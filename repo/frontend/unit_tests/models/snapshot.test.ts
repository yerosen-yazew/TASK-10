// REQ: snapshot model fixtures

import { describe, expect, it } from 'vitest'
import type { Snapshot, SnapshotData, RollbackMetadata, AutoSaveState } from '@/models/snapshot'

describe('snapshot model', () => {
  it('accepts snapshot and snapshot data fixtures', () => {
    const data: SnapshotData = {
      elements: [],
      chatMessages: [],
      pinnedMessages: [],
      commentThreads: [],
      comments: [],
      members: [],
      activityEvents: [],
    }

    const snapshot: Snapshot = {
      snapshotId: 'snap-1',
      roomId: 'room-1',
      sequenceNumber: 1,
      data,
      createdAt: '2026-01-01T00:00:00.000Z',
      sizeBytes: 2048,
    }

    expect(snapshot.sequenceNumber).toBe(1)
    expect(snapshot.data.elements).toHaveLength(0)
  })

  it('accepts rollback metadata and autosave state fixtures', () => {
    const rollback: RollbackMetadata = {
      rollbackId: 'rb-1',
      roomId: 'room-1',
      sourceSnapshotId: 'snap-1',
      sourceSequenceNumber: 1,
      initiatorId: 'host-1',
      initiatorDisplayName: 'Host',
      resultingSnapshotId: 'snap-2',
      rolledBackAt: '2026-01-01T00:01:00.000Z',
    }

    const autosave: AutoSaveState = {
      roomId: 'room-1',
      lastSavedAt: null,
      isDirty: false,
      isSaving: false,
      lastError: null,
    }

    expect(rollback.resultingSnapshotId).toBe('snap-2')
    expect(autosave.isSaving).toBe(false)
  })
})

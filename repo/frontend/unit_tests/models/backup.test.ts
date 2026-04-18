// REQ: backup model contract fixtures

import { describe, expect, it } from 'vitest'
import { BACKUP_FORMAT } from '@/models/constants'
import type { BackupManifest, ImportValidationResult } from '@/models/backup'

describe('backup model', () => {
  it('accepts a valid backup manifest fixture', () => {
    const manifest: BackupManifest = {
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      exportedBy: 'Host',
      roomId: 'room-1',
      roomName: 'Design Room',
      format: BACKUP_FORMAT,
      data: {
        room: {
          roomId: 'room-1',
          name: 'Design Room',
          description: '',
          hostProfileId: 'host-1',
          pairingCode: 'ABCD-2345',
          settings: { requireApproval: true, enableSecondReviewer: false },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        members: [],
        elements: [],
        images: [],
        commentThreads: [],
        comments: [],
        chatMessages: [],
        pinnedMessages: [],
        activityFeed: [],
        snapshots: [],
      },
      stats: {
        totalElements: 0,
        totalImages: 0,
        totalComments: 0,
        totalChatMessages: 0,
        totalSnapshots: 0,
        fileSizeBytes: 512,
      },
    }

    expect(manifest.format).toBe(BACKUP_FORMAT)
    expect(manifest.data.room.roomId).toBe('room-1')
    expect(manifest.stats.fileSizeBytes).toBeGreaterThan(0)
  })

  it('accepts a valid import validation result fixture', () => {
    const result: ImportValidationResult = {
      success: true,
      totalRows: 12,
      validRows: 12,
      errorRows: [],
      warnings: [],
      truncated: false,
    }

    expect(result.success).toBe(true)
    expect(result.errorRows).toHaveLength(0)
    expect(result.totalRows).toBe(result.validRows)
  })
})

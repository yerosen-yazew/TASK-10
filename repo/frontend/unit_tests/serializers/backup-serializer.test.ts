// REQ: R20 — Backup manifest building and deserialization
import { describe, it, expect } from 'vitest'
import {
  buildBackupManifest,
  serializeBackup,
  deserializeBackup,
  estimateBackupSize,
} from '@/serializers/backup-serializer'
import type { BackupBuildInput } from '@/serializers/backup-serializer'
import { BACKUP_FORMAT } from '@/models/constants'
import type { Room } from '@/models/room'

const sampleRoom: Room = {
  roomId: 'room-1',
  name: 'Test Room',
  description: 'A test room',
  hostProfileId: 'host-1',
  pairingCode: 'ABCD-EFGH',
  settings: { requireApproval: true, enableSecondReviewer: false },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const sampleInput: BackupBuildInput = {
  room: sampleRoom,
  members: [],
  elements: [],
  images: [],
  commentThreads: [],
  comments: [],
  chatMessages: [],
  pinnedMessages: [],
  activityFeed: [],
  snapshots: [],
  exportedBy: 'Test User',
}

describe('buildBackupManifest', () => {
  it('creates a manifest with the correct format', () => {
    const manifest = buildBackupManifest(sampleInput)
    expect(manifest.format).toBe(BACKUP_FORMAT)
    expect(manifest.version).toBe(1)
  })

  it('includes the room metadata', () => {
    const manifest = buildBackupManifest(sampleInput)
    expect(manifest.roomId).toBe('room-1')
    expect(manifest.roomName).toBe('Test Room')
    expect(manifest.exportedBy).toBe('Test User')
  })

  it('calculates stats correctly', () => {
    const manifest = buildBackupManifest(sampleInput)
    expect(manifest.stats.totalElements).toBe(0)
    expect(manifest.stats.totalImages).toBe(0)
    expect(manifest.stats.totalComments).toBe(0)
    expect(manifest.stats.totalChatMessages).toBe(0)
    expect(manifest.stats.totalSnapshots).toBe(0)
    expect(manifest.stats.fileSizeBytes).toBeGreaterThan(0)
  })

  it('sets exportedAt to a valid ISO timestamp', () => {
    const manifest = buildBackupManifest(sampleInput)
    expect(new Date(manifest.exportedAt).toISOString()).toBe(manifest.exportedAt)
  })
})

describe('serializeBackup / deserializeBackup', () => {
  it('roundtrips a manifest', () => {
    const manifest = buildBackupManifest(sampleInput)
    const json = serializeBackup(manifest)
    const restored = deserializeBackup(json)
    expect(restored).not.toBeNull()
    expect(restored!.roomId).toBe('room-1')
    expect(restored!.format).toBe(BACKUP_FORMAT)
  })

  it('returns null for invalid JSON', () => {
    expect(deserializeBackup('not json')).toBeNull()
  })

  it('returns null for wrong format', () => {
    const json = JSON.stringify({ version: 1, format: 'wrong' })
    expect(deserializeBackup(json)).toBeNull()
  })

  it('returns null for wrong version', () => {
    const json = JSON.stringify({ version: 99, format: BACKUP_FORMAT })
    expect(deserializeBackup(json)).toBeNull()
  })
})

describe('estimateBackupSize', () => {
  it('returns a positive number for non-empty input', () => {
    expect(estimateBackupSize(sampleInput)).toBeGreaterThan(0)
  })

  it('grows with more data', () => {
    const small = estimateBackupSize(sampleInput)
    const larger = estimateBackupSize({
      ...sampleInput,
      chatMessages: Array.from({ length: 100 }, (_, i) => ({
        messageId: `msg-${i}`,
        roomId: 'room-1',
        authorId: 'author-1',
        authorDisplayName: 'Author',
        text: 'Hello world message content here',
        mentions: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        isDeleted: false,
      })),
    })
    expect(larger).toBeGreaterThan(small)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useImportExportStore } from '@/stores/import-export-store'
import { setupNoMockTestEnv, seedActiveHostRoom } from '../integration/no-mock-test-harness'
import { roomRepository } from '@/services/room-repository'
import { memberRepository } from '@/services/member-repository'
import { elementRepository } from '@/services/element-repository'
import { commentThreadRepository } from '@/services/comment-thread-repository'
import { commentRepository } from '@/services/comment-repository'
import { chatMessageRepository } from '@/services/chat-message-repository'
import { pinnedMessageRepository } from '@/services/pinned-message-repository'
import { activityRepository } from '@/services/activity-repository'
import { snapshotRepository } from '@/services/snapshot-repository'
import { imageBlobRepository } from '@/services/image-blob-repository'
import { buildBackupManifest } from '@/serializers/backup-serializer'
import { createSticky } from '@/engine/element-engine'
import { sendMessage } from '@/engine/chat-engine'
import { createThread, appendComment } from '@/engine/comment-engine'
import { captureSnapshot } from '@/engine/snapshot-engine'
import { RoomRole } from '@/models/room'
import { MAX_BACKUP_SIZE_BYTES } from '@/models/constants'

function actor(memberId: string, displayName: string) {
  return { memberId, displayName, role: RoomRole.Host }
}

async function buildManifest(roomId: string, exportedBy: string) {
  const room = await roomRepository.getById(roomId)
  if (!room) throw new Error('Missing room for export manifest builder')

  return buildBackupManifest({
    room,
    members: await memberRepository.listByRoom(roomId),
    elements: await elementRepository.listByRoom(roomId),
    images: (await imageBlobRepository.listByRoom(roomId)).map((img) => ({
      imageId: img.imageId,
      elementId: img.elementId,
      fileName: img.fileName,
      mimeType: img.mimeType,
      fileSizeBytes: img.fileSizeBytes,
      base64Data: '',
    })),
    commentThreads: await commentThreadRepository.listByRoom(roomId),
    comments: await commentRepository.listByRoom(roomId),
    chatMessages: await chatMessageRepository.listByRoom(roomId),
    pinnedMessages: await pinnedMessageRepository.listByRoom(roomId),
    activityFeed: await activityRepository.listByRoom(roomId),
    snapshots: await snapshotRepository.listByRoom(roomId),
    exportedBy,
  })
}

describe('import-export-store no-mock integration', () => {
  beforeEach(async () => {
    await setupNoMockTestEnv()
    if (typeof URL.createObjectURL !== 'function') {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: () => 'blob:nomock',
      })
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: () => {},
      })
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:nomock')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('exportRoom sets error for missing room', async () => {
    const store = useImportExportStore()

    await store.exportRoom('missing-room', 'Exporter')

    expect(store.lastError).toBe('Room not found.')
  })

  it('exportRoom succeeds for real seeded room', async () => {
    const { room, host } = await seedActiveHostRoom({ name: 'Export Success Room' })
    const store = useImportExportStore()

    await store.exportRoom(room.roomId, host.displayName)

    expect(store.lastError).toBeNull()
    expect(store.exportProgress).toBe(100)
  })

  it('validateImport rejects invalid JSON content', async () => {
    const store = useImportExportStore()
    const file = new File(['not-json'], 'invalid.json', { type: 'application/json' })

    const result = await store.validateImport(file)

    expect(result?.success).toBe(false)
    expect(result?.errorRows[0].error).toContain('not valid JSON')
  })

  it('validateImport rejects invalid backup format', async () => {
    const store = useImportExportStore()
    const file = new File([
      JSON.stringify({
        version: 1,
        format: 'wrong-format',
        exportedAt: new Date().toISOString(),
        exportedBy: 'x',
        roomId: 'room-1',
        roomName: 'Room',
        stats: { totalElements: 0, totalImages: 0, totalComments: 0, totalChatMessages: 0, totalSnapshots: 0, fileSizeBytes: 1 },
        data: { room: {}, members: [], elements: [], images: [], commentThreads: [], comments: [], chatMessages: [], pinnedMessages: [], activityFeed: [], snapshots: [] },
      }),
    ], 'wrong-format.json', { type: 'application/json' })

    const result = await store.validateImport(file)

    expect(result?.success).toBe(false)
    expect(result?.errorRows.some((e) => e.field === 'format')).toBe(true)
  })

  it('validateImport succeeds for a valid generated manifest', async () => {
    const { room, host } = await seedActiveHostRoom({ name: 'Validate Manifest Room' })
    const store = useImportExportStore()
    const manifest = await buildManifest(room.roomId, host.displayName)

    const file = new File([JSON.stringify(manifest)], 'valid-manifest.json', { type: 'application/json' })
    const result = await store.validateImport(file)

    expect(result?.success).toBe(true)
    expect((result?.errorRows.length ?? 1)).toBe(0)
  })

  it('parseManifest returns manifest for valid JSON file', async () => {
    const { room, host } = await seedActiveHostRoom({ name: 'Parse Manifest Room' })
    const store = useImportExportStore()
    const manifest = await buildManifest(room.roomId, host.displayName)

    const parsed = await store.parseManifest(new File([JSON.stringify(manifest)], 'parse.json', { type: 'application/json' }))

    expect(parsed?.roomId).toBe(room.roomId)
  })

  it('parseManifest returns null for invalid JSON content', async () => {
    const store = useImportExportStore()
    const parsed = await store.parseManifest(new File(['{bad'], 'invalid.json', { type: 'application/json' }))

    expect(parsed).toBeNull()
  })

  it('persistImport writes room and related rows for valid manifest', async () => {
    const { room, host } = await seedActiveHostRoom({ name: 'Persist Manifest Room' })
    const store = useImportExportStore()

    await createSticky({
      roomId: room.roomId,
      position: { x: 20, y: 20 },
      dimensions: { width: 180, height: 120 },
      text: 'persisted sticky',
      backgroundColor: '#fef9c3',
      textColor: '#1e293b',
      fontSize: 14,
      actor: actor(host.profileId, host.displayName),
    })
    await sendMessage({
      roomId: room.roomId,
      authorId: host.profileId,
      authorDisplayName: host.displayName,
      text: 'persisted message',
    })
    const thread = await createThread({
      roomId: room.roomId,
      elementId: 'persist-element',
      starter: {
        authorId: host.profileId,
        authorDisplayName: host.displayName,
        text: 'persisted thread starter',
      },
    })
    await appendComment({
      threadId: thread.thread!.threadId,
      authorId: host.profileId,
      authorDisplayName: host.displayName,
      text: 'persisted thread follow-up',
    })
    await captureSnapshot(room.roomId, 'manual')

    const manifest = await buildManifest(room.roomId, host.displayName)

    await store.persistImport(manifest)

    expect((await roomRepository.getById(room.roomId))?.name).toBe(room.name)
    expect((await elementRepository.listByRoom(room.roomId)).length).toBeGreaterThan(0)
    expect((await chatMessageRepository.listByRoom(room.roomId)).length).toBeGreaterThan(0)
  })

  it('persistImport throws when sticky/comment cap is exceeded', async () => {
    const { room, host } = await seedActiveHostRoom({ name: 'Cap Exceeded Room' })
    const store = useImportExportStore()
    const manifest = await buildManifest(room.roomId, host.displayName)

    manifest.data.elements = Array.from({ length: 1001 }, (_, i) => ({
      elementId: `el-${i}`,
      roomId: room.roomId,
      type: 'sticky-note' as const,
      position: { x: i, y: i },
      zIndex: i + 1,
      createdBy: host.profileId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dimensions: { width: 140, height: 90 },
      text: 'x',
      backgroundColor: '#fef9c3',
      textColor: '#1e293b',
      fontSize: 14,
    })) as any
    manifest.data.comments = [{
      commentId: 'c-1',
      threadId: 't-1',
      roomId: room.roomId,
      authorId: host.profileId,
      authorDisplayName: host.displayName,
      text: 'x',
      mentions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEdited: false,
      isDeleted: false,
    }]

    await expect(store.persistImport(manifest)).rejects.toThrow(/cap/)
  })

  it('validateImport rejects file above max backup size', async () => {
    const store = useImportExportStore()
    const file = new File(['{}'], 'oversize.json', { type: 'application/json' })
    Object.defineProperty(file, 'size', { value: MAX_BACKUP_SIZE_BYTES + 1 })

    const result = await store.validateImport(file)

    expect(result?.success).toBe(false)
    expect(result?.errorRows[0].field).toBe('fileSize')
  })

  it('validateImport surfaces row-level errors for malformed element rows', async () => {
    const store = useImportExportStore()
    const malformed = {
      version: 1,
      format: 'forgeroom-backup-v1',
      exportedAt: new Date().toISOString(),
      exportedBy: 'tester',
      roomId: 'r-1',
      roomName: 'Malformed Room',
      stats: { totalElements: 1, totalImages: 0, totalComments: 0, totalChatMessages: 0, totalSnapshots: 0, fileSizeBytes: 1 },
      data: {
        room: {
          roomId: 'r-1',
          name: 'Malformed Room',
          description: '',
          hostProfileId: 'h-1',
          pairingCode: 'ABCD-EFGH',
          settings: { requireApproval: false, enableSecondReviewer: false },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        members: [],
        elements: [{ broken: true }],
        images: [],
        commentThreads: [],
        comments: [],
        chatMessages: [],
        pinnedMessages: [],
        activityFeed: [],
        snapshots: [],
      },
    }

    const result = await store.validateImport(new File([JSON.stringify(malformed)], 'malformed.json', { type: 'application/json' }))

    expect(result?.success).toBe(false)
    expect(result?.errorRows.some((e) => e.rowType === 'element')).toBe(true)
  })

  it('clearError resets store lastError', async () => {
    const store = useImportExportStore()

    await store.exportRoom('missing-room', 'Tester')
    expect(store.lastError).toBeTruthy()

    store.clearError()
    expect(store.lastError).toBeNull()
  })

  it('validateImport updates progress and resets importing flag', async () => {
    const { room, host } = await seedActiveHostRoom({ name: 'Progress Room' })
    const manifest = await buildManifest(room.roomId, host.displayName)
    const store = useImportExportStore()

    const result = await store.validateImport(new File([JSON.stringify(manifest)], 'progress.json', { type: 'application/json' }))

    expect(result?.success).toBe(true)
    expect(store.importProgress).toBe(100)
    expect(store.isImporting).toBe(false)
  })
})

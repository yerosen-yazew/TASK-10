// REQ: R20 — Backup export/import store: size limit, row validation, batch cap, partial failure
// REQ: R20 — Backup image roundtrip: export encodes blobs as base64; persistImport restores them

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useImportExportStore } from '@/stores/import-export-store'
import { MAX_BACKUP_SIZE_BYTES, MAX_BULK_IMPORT_ITEMS, BACKUP_FORMAT } from '@/models/constants'

// ── Repository mocks ────────────────────────────────────────────────────────

const mockRoom = {
  roomId: 'room-1',
  name: 'Test Room',
  settings: { requireApproval: false, enableSecondReviewer: false },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

vi.mock('@/services/room-repository', () => ({
  roomRepository: {
    getById: vi.fn(async () => mockRoom),
    put: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/member-repository', () => ({
  memberRepository: {
    listByRoom: vi.fn(async () => []),
    put: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/element-repository', () => ({
  elementRepository: {
    listByRoom: vi.fn(async () => []),
    put: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/comment-thread-repository', () => ({
  commentThreadRepository: {
    listByRoom: vi.fn(async () => []),
    put: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/comment-repository', () => ({
  commentRepository: {
    listByRoom: vi.fn(async () => []),
    put: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/chat-message-repository', () => ({
  chatMessageRepository: {
    listByRoom: vi.fn(async () => []),
    put: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/pinned-message-repository', () => ({
  pinnedMessageRepository: {
    listByRoom: vi.fn(async () => []),
    put: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/activity-repository', () => ({
  activityRepository: {
    listByRoom: vi.fn(async () => []),
    put: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/snapshot-repository', () => ({
  snapshotRepository: {
    listByRoom: vi.fn(async () => []),
    put: vi.fn(async () => {}),
  },
}))
vi.mock('@/services/image-blob-repository', () => ({
  imageBlobRepository: {
    listByRoom: vi.fn(async () => []),
    put: vi.fn(async () => {}),
  },
}))
vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

// Mock document.createElement to capture download trigger
const mockAnchorClick = vi.fn()
vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
  if (tag === 'a') {
    return { href: '', download: '', click: mockAnchorClick } as unknown as HTMLAnchorElement
  }
  return document.createElement(tag)
})
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:fake'),
  revokeObjectURL: vi.fn(),
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeValidManifest(overrides: Record<string, unknown> = {}): unknown {
  return {
    version: 1,
    format: BACKUP_FORMAT,
    exportedAt: '2026-01-01T00:00:00.000Z',
    exportedBy: 'Test User',
    roomId: 'room-1',
    roomName: 'Test Room',
    stats: {
      totalElements: 0,
      totalImages: 0,
      totalComments: 0,
      totalChatMessages: 0,
      totalSnapshots: 0,
      fileSizeBytes: 100,
    },
    data: {
      room: mockRoom,
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
    ...overrides,
  }
}

function makeFile(content: string, size?: number): File {
  const file = new File([content], 'backup.json', { type: 'application/json' })
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size })
  }
  return file
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('import-export-store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockAnchorClick.mockClear()
  })

  // ── Export ─────────────────────────────────────────────────────────────────

  describe('exportRoom', () => {
    it('triggers download on success', async () => {
      const store = useImportExportStore()
      await store.exportRoom('room-1', 'Alice')
      expect(mockAnchorClick).toHaveBeenCalled()
      expect(store.lastError).toBeNull()
      expect(store.exportProgress).toBe(100)
      expect(store.isExporting).toBe(false)
    })

    it('sets lastError when room not found', async () => {
      const { roomRepository } = await import('@/services/room-repository')
      vi.mocked(roomRepository.getById).mockResolvedValueOnce(undefined)
      const store = useImportExportStore()
      await store.exportRoom('missing-room', 'Alice')
      expect(store.lastError).toBe('Room not found.')
      expect(mockAnchorClick).not.toHaveBeenCalled()
    })

    it('resets isExporting when room not found', async () => {
      const { roomRepository } = await import('@/services/room-repository')
      vi.mocked(roomRepository.getById).mockResolvedValueOnce(undefined)
      const store = useImportExportStore()
      await store.exportRoom('missing-room', 'Alice')
      expect(store.isExporting).toBe(false)
    })

    it('rejects when estimated size exceeds 200 MB', async () => {
      const { elementRepository } = await import('@/services/element-repository')
      // Simulate many large elements to inflate estimated size
      const bigElements = Array.from({ length: 1 }, () => ({
        elementId: 'el-1',
        type: 'sticky-note',
        data: 'x'.repeat(MAX_BACKUP_SIZE_BYTES + 1),
      }))
      vi.mocked(elementRepository.listByRoom).mockResolvedValueOnce(bigElements as any)
      const store = useImportExportStore()
      await store.exportRoom('room-1', 'Alice')
      // Either the pre-check or post-check will catch the size
      expect(store.lastError).toBeTruthy()
      expect(store.lastError).toContain('MB')
    })
  })

  // ── Validate import ────────────────────────────────────────────────────────

  describe('validateImport', () => {
    it('returns success for a valid backup file', async () => {
      const content = JSON.stringify(makeValidManifest())
      const file = makeFile(content)
      const store = useImportExportStore()
      const result = await store.validateImport(file)
      expect(result?.success).toBe(true)
      expect(store.lastImportResult?.success).toBe(true)
    })

    it('fails immediately if file exceeds 200 MB', async () => {
      const file = makeFile('{}', MAX_BACKUP_SIZE_BYTES + 1)
      const store = useImportExportStore()
      const result = await store.validateImport(file)
      expect(result?.success).toBe(false)
      expect(result?.errorRows[0].field).toBe('fileSize')
    })

    it('fails for invalid JSON', async () => {
      const file = makeFile('not-valid-json')
      const store = useImportExportStore()
      const result = await store.validateImport(file)
      expect(result?.success).toBe(false)
      expect(result?.errorRows[0].error).toContain('not valid JSON')
    })

    it('fails for wrong backup format', async () => {
      const content = JSON.stringify(makeValidManifest({ format: 'wrong-format' }))
      const file = makeFile(content)
      const store = useImportExportStore()
      const result = await store.validateImport(file)
      expect(result?.success).toBe(false)
      expect(result?.errorRows.some((e) => e.field === 'format')).toBe(true)
    })

    it('reports row-level errors for invalid elements', async () => {
      const manifest = makeValidManifest({
        data: {
          room: mockRoom,
          members: [],
          elements: [{ bad: 'data' }],
          images: [],
          commentThreads: [],
          comments: [],
          chatMessages: [],
          pinnedMessages: [],
          activityFeed: [],
          snapshots: [],
        },
      })
      const file = makeFile(JSON.stringify(manifest))
      const store = useImportExportStore()
      const result = await store.validateImport(file)
      expect(result?.success).toBe(false)
      expect(result?.errorRows.some((e) => e.rowType === 'element')).toBe(true)
    })

    it('flags truncated and adds warning when batch cap exceeded', async () => {
      const manyElements = Array.from({ length: MAX_BULK_IMPORT_ITEMS + 1 }, (_, i) => ({
        elementId: `el-${i}`,
        type: 'sticky-note',
      }))
      const manifest = makeValidManifest({
        data: {
          room: mockRoom,
          members: [],
          elements: manyElements,
          images: [],
          commentThreads: [],
          comments: [],
          chatMessages: [],
          pinnedMessages: [],
          activityFeed: [],
          snapshots: [],
        },
      })
      const file = makeFile(JSON.stringify(manifest))
      const store = useImportExportStore()
      const result = await store.validateImport(file)
      expect(result?.truncated).toBe(true)
      expect(result?.success).toBe(false)
      expect(result?.errorRows.some((e) => e.field === 'bulkImportCount')).toBe(true)
      expect(result?.warnings.length).toBeGreaterThan(0)
    })

    it('sets isImporting false when done', async () => {
      const content = JSON.stringify(makeValidManifest())
      const file = makeFile(content)
      const store = useImportExportStore()
      await store.validateImport(file)
      expect(store.isImporting).toBe(false)
    })
  })

  // ── Persist import ─────────────────────────────────────────────────────────

  describe('persistImport', () => {
    it('calls put on all repositories', async () => {
      const manifest = makeValidManifest() as any
      manifest.data.members = [{ memberId: 'm-1' }]
      manifest.data.elements = [{ elementId: 'el-1', type: 'sticky-note' }]

      const { memberRepository } = await import('@/services/member-repository')
      const { elementRepository } = await import('@/services/element-repository')
      const store = useImportExportStore()
      await store.persistImport(manifest as any)
      expect(vi.mocked(memberRepository.put)).toHaveBeenCalled()
      expect(vi.mocked(elementRepository.put)).toHaveBeenCalled()
    })

    it('sets isImporting false after success', async () => {
      const manifest = makeValidManifest() as any
      const store = useImportExportStore()
      await store.persistImport(manifest)
      expect(store.isImporting).toBe(false)
      expect(store.lastError).toBeNull()
    })

    it('rejects persist when sticky notes + comments exceed cap', async () => {
      const { elementRepository } = await import('@/services/element-repository')
      const manifest = makeValidManifest() as any
      manifest.data.elements = Array.from({ length: MAX_BULK_IMPORT_ITEMS + 1 }, (_, i) => ({
        elementId: `el-${i}`,
        roomId: 'room-1',
        type: 'sticky-note',
      }))
      manifest.data.comments = []

      const store = useImportExportStore()
      await expect(store.persistImport(manifest)).rejects.toThrow(/cap/i)
      expect(vi.mocked(elementRepository.put)).not.toHaveBeenCalled()
      expect(store.lastError).toBe('Failed to save imported data.')
    })

    it('sets lastError and rethrows on repository failure', async () => {
      const { roomRepository } = await import('@/services/room-repository')
      vi.mocked(roomRepository.put).mockRejectedValueOnce(new Error('DB error'))
      const manifest = makeValidManifest() as any
      const store = useImportExportStore()
      await expect(store.persistImport(manifest)).rejects.toThrow()
      expect(store.lastError).toBeTruthy()
    })
  })

  // ── Parse manifest ─────────────────────────────────────────────────────────

  describe('parseManifest', () => {
    it('returns a BackupManifest for valid JSON', async () => {
      const manifest = makeValidManifest()
      const file = makeFile(JSON.stringify(manifest))
      const store = useImportExportStore()
      const result = await store.parseManifest(file)
      expect(result?.roomId).toBe('room-1')
    })

    it('returns null for invalid JSON', async () => {
      const file = makeFile('not-json')
      const store = useImportExportStore()
      const result = await store.parseManifest(file)
      expect(result).toBeNull()
    })
  })

  // ── Image roundtrip ────────────────────────────────────────────────────────

  describe('image roundtrip (R20)', () => {
    it('exportRoom populates data.images with base64Data for every image in the room', async () => {
      const { imageBlobRepository } = await import('@/services/image-blob-repository')
      const fakeBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
      vi.mocked(imageBlobRepository.listByRoom).mockResolvedValueOnce([
        {
          imageId: 'img-1',
          roomId: 'room-1',
          elementId: 'el-1',
          blob: fakeBlob,
          fileName: 'pic.png',
          mimeType: 'image/png',
          fileSizeBytes: 3,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ] as any)

      // Capture the serialized blob content to verify images[] is populated
      let capturedJson = ''
      const originalBlob = globalThis.Blob
      ;(globalThis as any).Blob = class extends originalBlob {
        constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
          super(parts, opts)
          if (Array.isArray(parts) && typeof parts[0] === 'string' && (parts[0] as string).includes('"roomId"')) {
            capturedJson = parts[0] as string
          }
        }
      } as any

      const store = useImportExportStore()
      await store.exportRoom('room-1', 'Alice')
      ;(globalThis as any).Blob = originalBlob

      expect(store.lastError).toBeNull()
      expect(capturedJson).toContain('"images"')
      expect(capturedJson).toContain('"imageId":"img-1"')
      expect(capturedJson).toContain('"base64Data"')
      expect(capturedJson).toContain('"fileName":"pic.png"')
    })

    it('persistImport writes every image via imageBlobRepository.put', async () => {
      const { imageBlobRepository } = await import('@/services/image-blob-repository')
      const manifest = makeValidManifest({
        data: {
          room: mockRoom,
          members: [],
          elements: [],
          images: [
            {
              imageId: 'img-1',
              elementId: 'el-1',
              fileName: 'pic.png',
              mimeType: 'image/png',
              fileSizeBytes: 3,
              base64Data: 'AQID', // bytes [1,2,3]
            },
            {
              imageId: 'img-2',
              elementId: 'el-2',
              fileName: 'two.png',
              mimeType: 'image/png',
              fileSizeBytes: 3,
              base64Data: 'AQID',
            },
          ],
          commentThreads: [],
          comments: [],
          chatMessages: [],
          pinnedMessages: [],
          activityFeed: [],
          snapshots: [],
        },
      }) as any

      const store = useImportExportStore()
      await store.persistImport(manifest)
      expect(vi.mocked(imageBlobRepository.put)).toHaveBeenCalledTimes(2)
      const firstCall = vi.mocked(imageBlobRepository.put).mock.calls[0][0] as any
      expect(firstCall.imageId).toBe('img-1')
      expect(firstCall.elementId).toBe('el-1')
      expect(firstCall.fileName).toBe('pic.png')
      expect(firstCall.mimeType).toBe('image/png')
      expect(firstCall.blob).toBeInstanceOf(Blob)
    })
  })

  // ── clearError ─────────────────────────────────────────────────────────────

  describe('clearError', () => {
    it('resets lastError', async () => {
      const store = useImportExportStore()
      store.lastError = 'some error'
      store.clearError()
      expect(store.lastError).toBeNull()
    })
  })
})

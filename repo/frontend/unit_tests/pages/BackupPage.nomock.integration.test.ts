import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import BackupPage from '@/pages/BackupPage.vue'
import { setupNoMockTestEnv, seedActiveHostRoom } from '../integration/no-mock-test-harness'
import { useUiStore } from '@/stores/ui-store'
import { useImportExportStore } from '@/stores/import-export-store'
import { roomRepository } from '@/services/room-repository'
import { memberRepository } from '@/services/member-repository'
import { elementRepository } from '@/services/element-repository'
import { commentThreadRepository } from '@/services/comment-thread-repository'
import { commentRepository } from '@/services/comment-repository'
import { chatMessageRepository } from '@/services/chat-message-repository'
import { pinnedMessageRepository } from '@/services/pinned-message-repository'
import { activityRepository } from '@/services/activity-repository'
import { snapshotRepository } from '@/services/snapshot-repository'
import { buildBackupManifest } from '@/serializers/backup-serializer'
import { MAX_BACKUP_SIZE_BYTES } from '@/models/constants'

async function selectFile(wrapper: ReturnType<typeof mount>, file: File) {
  const input = wrapper.find('[data-testid="file-input"]')
  const inputEl = input.element as HTMLInputElement
  const fileListLike = {
    0: file,
    length: 1,
    item: (index: number) => (index === 0 ? file : null),
  }
  Object.defineProperty(inputEl, 'files', {
    configurable: true,
    writable: true,
    value: fileListLike,
  })
  await input.trigger('change')
}

function createPageRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/workspace/:roomId/backup', name: 'workspace-backup', component: BackupPage, props: true },
      { path: '/workspace/:roomId', name: 'workspace', component: { template: '<div />' }, props: true },
    ],
  })
}

async function mountPage(roomId: string) {
  const router = createPageRouter()
  await router.push(`/workspace/${roomId}/backup`)
  const wrapper = mount(BackupPage, {
    props: { roomId },
    global: {
      plugins: [router],
    },
  })
  await flushPromises()
  return { wrapper, router }
}

async function buildManifestForRoom(roomId: string, exportedBy: string) {
  const room = await roomRepository.getById(roomId)
  if (!room) throw new Error('Missing room for manifest test builder')

  return buildBackupManifest({
    room,
    members: await memberRepository.listByRoom(roomId),
    elements: await elementRepository.listByRoom(roomId),
    images: [],
    commentThreads: await commentThreadRepository.listByRoom(roomId),
    comments: await commentRepository.listByRoom(roomId),
    chatMessages: await chatMessageRepository.listByRoom(roomId),
    pinnedMessages: await pinnedMessageRepository.listByRoom(roomId),
    activityFeed: await activityRepository.listByRoom(roomId),
    snapshots: await snapshotRepository.listByRoom(roomId),
    exportedBy,
  })
}

describe('BackupPage no-mock integration', () => {
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
  })

  it('renders export and import sections', async () => {
    const { room } = await seedActiveHostRoom({ name: 'Backup UI Room' })
    const { wrapper } = await mountPage(room.roomId)

    expect(wrapper.text()).toContain('Export Room Backup')
    expect(wrapper.text()).toContain('Import Room Backup')
  })

  it('exports backup and posts success toast on valid room', async () => {
    const { room } = await seedActiveHostRoom({ name: 'Exportable Room' })
    const { wrapper } = await mountPage(room.roomId)
    const ui = useUiStore()

    await wrapper.find('[data-testid="export-btn"]').trigger('click')
    await vi.waitFor(() => {
      expect(ui.toasts.some((t) => t.message.includes('Backup downloaded'))).toBe(true)
    })
  })

  it('shows export error toast for unknown room', async () => {
    const { wrapper } = await mountPage('missing-room')
    const ui = useUiStore()

    await wrapper.find('[data-testid="export-btn"]').trigger('click')
    await vi.waitFor(() => {
      expect(ui.toasts.some((t) => t.type === 'error')).toBe(true)
    })
  })

  it('shows validation failure for invalid JSON import file', async () => {
    const { room } = await seedActiveHostRoom({ name: 'Invalid JSON Room' })
    const { wrapper } = await mountPage(room.roomId)

    await selectFile(wrapper, new File(['not-json'], 'invalid.json', { type: 'application/json' }))
    await flushPromises()
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="validation-result"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Validation failed')
    })
  })

  it('shows manifest preview and confirm action for valid backup file', async () => {
    const { room, host } = await seedActiveHostRoom({ name: 'Valid Import Room' })
    const manifest = await buildManifestForRoom(room.roomId, host.displayName)
    const file = new File([JSON.stringify(manifest)], 'valid.json', { type: 'application/json' })

    const { wrapper } = await mountPage(room.roomId)
    await selectFile(wrapper, file)
    await flushPromises()
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="manifest-preview"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="confirm-import-btn"]').exists()).toBe(true)
    })
  })

  it('cancel import hides manifest preview and clears import action state', async () => {
    const { room, host } = await seedActiveHostRoom({ name: 'Cancelable Import Room' })
    const manifest = await buildManifestForRoom(room.roomId, host.displayName)
    const file = new File([JSON.stringify(manifest)], 'valid.json', { type: 'application/json' })
    const { wrapper } = await mountPage(room.roomId)

    await selectFile(wrapper, file)
    await flushPromises()
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="manifest-preview"]').exists()).toBe(true)
    })

    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === 'Cancel')
    expect(cancelBtn).toBeDefined()
    await cancelBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="manifest-preview"]').exists()).toBe(false)
  })

  it('shows persist error and stays on backup page when confirmed import fails', async () => {
    const { room, host } = await seedActiveHostRoom({ name: 'Persist Import Room' })
    const manifest = await buildManifestForRoom(room.roomId, host.displayName)
    const importRoomId = `import-room-${Date.now()}`
    const cleanManifest = {
      ...manifest,
      roomId: importRoomId,
      roomName: 'Imported Room',
      data: {
        ...manifest.data,
        room: {
          ...manifest.data.room,
          roomId: importRoomId,
          name: 'Imported Room',
          pairingCode: `IMP${String(Date.now()).slice(-6)}`,
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
        ...manifest.stats,
        totalElements: 0,
        totalImages: 0,
        totalComments: 0,
        totalChatMessages: 0,
        totalSnapshots: 0,
      },
    }
    const file = new File([JSON.stringify(cleanManifest)], 'persist.json', { type: 'application/json' })

    const { wrapper, router } = await mountPage(room.roomId)
    const ui = useUiStore()

    await selectFile(wrapper, file)
    await flushPromises()

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="confirm-import-btn"]').exists()).toBe(true)
    })
    const confirmBtn = wrapper.find('[data-testid="confirm-import-btn"]')
    await confirmBtn.trigger('click')
    await flushPromises()

    await vi.waitFor(() => {
      expect(ui.pendingConfirm).not.toBeNull()
    })
    ui.resolveConfirm(true)
    await vi.waitFor(() => {
      expect(router.currentRoute.value.name).toBe('workspace-backup')
      expect(wrapper.find('[data-testid="persist-error"]').exists()).toBe(true)
      expect(ui.toasts.some((t) => t.type === 'error')).toBe(true)
    })
  })

  it('does not navigate when user rejects confirm dialog', async () => {
    const { room, host } = await seedActiveHostRoom({ name: 'Rejected Import Room' })
    const manifest = await buildManifestForRoom(room.roomId, host.displayName)
    const file = new File([JSON.stringify(manifest)], 'reject.json', { type: 'application/json' })

    const { wrapper, router } = await mountPage(room.roomId)
    const ui = useUiStore()

    await selectFile(wrapper, file)
    await flushPromises()

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="confirm-import-btn"]').exists()).toBe(true)
    })
    await wrapper.find('[data-testid="confirm-import-btn"]').trigger('click')
    await flushPromises()

    await vi.waitFor(() => {
      expect(ui.pendingConfirm).not.toBeNull()
    })
    ui.resolveConfirm(false)
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('workspace-backup')
  })

  it('flags oversize import file beyond max backup size', async () => {
    const { room } = await seedActiveHostRoom({ name: 'Oversize Import Room' })
    const file = new File(['{}'], 'oversize.json', { type: 'application/json' })
    Object.defineProperty(file, 'size', { value: MAX_BACKUP_SIZE_BYTES + 1 })

    const { wrapper } = await mountPage(room.roomId)
    await selectFile(wrapper, file)
    await flushPromises()

    expect(wrapper.text()).toContain('File exceeds the 200 MB limit')
  })

  it('shows row-level errors for structurally invalid backup rows', async () => {
    const { room } = await seedActiveHostRoom({ name: 'Row Error Room' })
    const invalidManifest = {
      version: 1,
      format: 'forgeroom-backup-v1',
      exportedAt: new Date().toISOString(),
      exportedBy: 'Tester',
      roomId: room.roomId,
      roomName: room.name,
      stats: { totalElements: 1, totalImages: 0, totalComments: 0, totalChatMessages: 0, totalSnapshots: 0, fileSizeBytes: 64 },
      data: {
        room,
        members: [],
        elements: [{ bad: 'shape' }],
        images: [],
        commentThreads: [],
        comments: [],
        chatMessages: [],
        pinnedMessages: [],
        activityFeed: [],
        snapshots: [],
      },
    }

    const file = new File([JSON.stringify(invalidManifest)], 'invalid-rows.json', { type: 'application/json' })
    const { wrapper } = await mountPage(room.roomId)

    await selectFile(wrapper, file)
    await flushPromises()
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="row-errors"]').exists()).toBe(true)
    })
  })

  it('shows truncation warning when import exceeds sticky/comment cap', async () => {
    const { room } = await seedActiveHostRoom({ name: 'Cap Room' })
    const hugeManifest = {
      version: 1,
      format: 'forgeroom-backup-v1',
      exportedAt: new Date().toISOString(),
      exportedBy: 'Tester',
      roomId: room.roomId,
      roomName: room.name,
      stats: { totalElements: 1001, totalImages: 0, totalComments: 1, totalChatMessages: 0, totalSnapshots: 0, fileSizeBytes: 64 },
      data: {
        room,
        members: [],
        elements: Array.from({ length: 1001 }, (_, i) => ({
          elementId: `el-${i}`,
          roomId: room.roomId,
          type: 'sticky-note',
          position: { x: 0, y: 0 },
          zIndex: i + 1,
          createdBy: 'seed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          dimensions: { width: 160, height: 120 },
          text: 'x',
          backgroundColor: '#fef9c3',
          textColor: '#1e293b',
          fontSize: 14,
        })),
        images: [],
        commentThreads: [],
        comments: [{
          commentId: 'c-1',
          threadId: 't-1',
          roomId: room.roomId,
          authorId: 'seed',
          authorDisplayName: 'Seed',
          text: 'x',
          mentions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isEdited: false,
          isDeleted: false,
        }],
        chatMessages: [],
        pinnedMessages: [],
        activityFeed: [],
        snapshots: [],
      },
    }

    const file = new File([JSON.stringify(hugeManifest)], 'truncated.json', { type: 'application/json' })
    const { wrapper } = await mountPage(room.roomId)

    await selectFile(wrapper, file)
    await flushPromises()
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="truncation-notice"]').exists()).toBe(true)
    })
  })

  it('exposes import-export store state transitions while validating file', async () => {
    const { room } = await seedActiveHostRoom({ name: 'State Room' })
    const store = useImportExportStore()
    const { wrapper } = await mountPage(room.roomId)

    const file = new File(['not-json'], 'state.json', { type: 'application/json' })
    await selectFile(wrapper, file)
    await flushPromises()
    await vi.waitFor(() => {
      expect(store.isImporting).toBe(false)
      expect(store.lastImportResult).not.toBeNull()
    })
  })
})

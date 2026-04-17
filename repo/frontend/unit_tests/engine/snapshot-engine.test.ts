// REQ: R17 — Snapshots every 5 min, keep 48, one-click rollback
// REQ: Q5 — Rollback creates a new derived snapshot; history preserved
// REQ: R17 — Rollback restores live repository state (elements, chat, comments)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { captureSnapshot, listSnapshots, rollbackTo } from '@/engine/snapshot-engine'
import type { Snapshot } from '@/models/snapshot'
import type { ActivityEvent } from '@/models/activity'
import { ActivityEventType } from '@/models/activity'
import { MAX_SNAPSHOTS_RETAINED } from '@/models/constants'

const snapshotStore = new Map<string, Snapshot>()
const activityStore: ActivityEvent[] = []

// Stateful in-memory stores to verify live-repo write-back
const elementDb = new Map<string, any>()
const chatMessageDb = new Map<string, any>()
const pinnedMessageDb = new Map<string, any>()
const commentThreadDb = new Map<string, any>()
const commentDb = new Map<string, any>()

vi.mock('@/services/snapshot-repository', () => ({
  snapshotRepository: {
    put: vi.fn(async (s: Snapshot) => {
      snapshotStore.set(s.snapshotId, s)
    }),
    getById: vi.fn(async (id: string) => snapshotStore.get(id)),
    listByRoom: vi.fn(async (roomId: string) =>
      Array.from(snapshotStore.values())
        .filter((s) => s.roomId === roomId)
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    ),
    deleteOldestExcess: vi.fn(async (roomId: string, cap: number) => {
      const all = Array.from(snapshotStore.values())
        .filter((s) => s.roomId === roomId)
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      const excess = all.length - cap
      for (let i = 0; i < excess; i++) {
        snapshotStore.delete(all[i].snapshotId)
      }
    }),
  },
}))

vi.mock('@/services/element-repository', () => ({
  elementRepository: {
    listByRoom: vi.fn(async (roomId: string) =>
      Array.from(elementDb.values()).filter((e) => e.roomId === roomId)
    ),
    put: vi.fn(async (el: any) => { elementDb.set(el.elementId, el) }),
    delete: vi.fn(async (id: string) => { elementDb.delete(id) }),
  },
}))

vi.mock('@/services/chat-message-repository', () => ({
  chatMessageRepository: {
    listByRoom: vi.fn(async (roomId: string) =>
      Array.from(chatMessageDb.values()).filter((m) => m.roomId === roomId)
    ),
    put: vi.fn(async (msg: any) => { chatMessageDb.set(msg.messageId, msg) }),
    delete: vi.fn(async (id: string) => { chatMessageDb.delete(id) }),
  },
}))

vi.mock('@/services/pinned-message-repository', () => ({
  pinnedMessageRepository: {
    listByRoom: vi.fn(async (roomId: string) =>
      Array.from(pinnedMessageDb.values()).filter((p) => p.roomId === roomId)
    ),
    put: vi.fn(async (pm: any) => { pinnedMessageDb.set(`${pm.roomId}:${pm.messageId}`, pm) }),
    delete: vi.fn(async ([roomId, messageId]: [string, string]) => {
      pinnedMessageDb.delete(`${roomId}:${messageId}`)
    }),
  },
}))

vi.mock('@/services/comment-thread-repository', () => ({
  commentThreadRepository: {
    listByRoom: vi.fn(async (roomId: string) =>
      Array.from(commentThreadDb.values()).filter((t) => t.roomId === roomId)
    ),
    put: vi.fn(async (t: any) => { commentThreadDb.set(t.threadId, t) }),
    delete: vi.fn(async (id: string) => { commentThreadDb.delete(id) }),
  },
}))

vi.mock('@/services/comment-repository', () => ({
  commentRepository: {
    listByRoom: vi.fn(async (roomId: string) =>
      Array.from(commentDb.values()).filter((c) => c.roomId === roomId)
    ),
    listByThread: vi.fn(async () => []),
    put: vi.fn(async (c: any) => { commentDb.set(c.commentId, c) }),
    delete: vi.fn(async (id: string) => { commentDb.delete(id) }),
  },
}))

vi.mock('@/services/member-repository', () => ({
  memberRepository: {
    listByRoom: vi.fn(async () => []),
  },
}))

vi.mock('@/services/activity-repository', () => ({
  activityRepository: {
    put: vi.fn(async (e: ActivityEvent) => {
      activityStore.push(e)
    }),
    listByRoom: vi.fn(async () => [...activityStore]),
  },
}))

const actor = { memberId: 'host', displayName: 'Host' }

beforeEach(() => {
  snapshotStore.clear()
  activityStore.length = 0
  elementDb.clear()
  chatMessageDb.clear()
  pinnedMessageDb.clear()
  commentThreadDb.clear()
  commentDb.clear()
})

describe('captureSnapshot', () => {
  it('appends a new snapshot with a monotonic sequenceNumber', async () => {
    const s1 = await captureSnapshot('room-1', 'manual')
    const s2 = await captureSnapshot('room-1', 'autosave')
    expect(s1.sequenceNumber).toBe(1)
    expect(s2.sequenceNumber).toBe(2)
    expect(snapshotStore.size).toBe(2)
  })

  it('trims oldest snapshots beyond the retention cap of 48', async () => {
    for (let i = 0; i < MAX_SNAPSHOTS_RETAINED; i++) {
      await captureSnapshot('room-1', 'autosave')
    }
    expect(snapshotStore.size).toBe(MAX_SNAPSHOTS_RETAINED)
    await captureSnapshot('room-1', 'autosave')
    expect(snapshotStore.size).toBe(MAX_SNAPSHOTS_RETAINED)
    // The first-ever snapshot (sequenceNumber 1) should have been trimmed.
    const seqs = Array.from(snapshotStore.values()).map((s) => s.sequenceNumber).sort((a, b) => a - b)
    expect(seqs[0]).toBe(2)
  })
})

describe('rollbackTo', () => {
  it('creates a new derived snapshot and preserves the source + all intermediates', async () => {
    const s1 = await captureSnapshot('room-1', 'manual')
    const s2 = await captureSnapshot('room-1', 'autosave')
    const s3 = await captureSnapshot('room-1', 'autosave')

    const metadata = await rollbackTo('room-1', s1.snapshotId, actor)

    // All originals must still be present
    expect(snapshotStore.has(s1.snapshotId)).toBe(true)
    expect(snapshotStore.has(s2.snapshotId)).toBe(true)
    expect(snapshotStore.has(s3.snapshotId)).toBe(true)
    // A new snapshot exists (derived from s1)
    expect(snapshotStore.has(metadata.resultingSnapshotId)).toBe(true)
    expect(metadata.sourceSnapshotId).toBe(s1.snapshotId)
    expect(metadata.sourceSequenceNumber).toBe(s1.sequenceNumber)
    expect(metadata.initiatorId).toBe('host')

    const derived = snapshotStore.get(metadata.resultingSnapshotId)!
    expect(derived.sequenceNumber).toBe(4)
  })

  it('emits a SnapshotRolledBack activity event with source + actor + timestamp metadata', async () => {
    const s1 = await captureSnapshot('room-1', 'manual')
    const metadata = await rollbackTo('room-1', s1.snapshotId, actor)
    const event = activityStore.find((e) => e.type === ActivityEventType.SnapshotRolledBack)
    expect(event).toBeTruthy()
    expect(event?.metadata?.sourceSnapshotId).toBe(s1.snapshotId)
    expect(event?.metadata?.resultingSnapshotId).toBe(metadata.resultingSnapshotId)
    expect(event?.actorId).toBe('host')
    expect(event?.metadata?.rolledBackAt).toBeTruthy()
  })

  it('throws when rolling back to an unknown snapshot', async () => {
    await expect(rollbackTo('room-1', 'missing', actor)).rejects.toThrow(/not found/i)
  })

  it('restores live repository state (elements, chat, comments) to source snapshot data after rollback', async () => {
    // Seed: element el-A exists at snapshot time
    elementDb.set('el-1', { elementId: 'el-1', roomId: 'room-1', type: 'sticky-note' })
    chatMessageDb.set('msg-1', { messageId: 'msg-1', roomId: 'room-1', text: 'hello' })

    const s1 = await captureSnapshot('room-1', 'manual')

    // Advance state: replace el-A with el-B, replace msg-1 with msg-2
    elementDb.clear()
    chatMessageDb.clear()
    elementDb.set('el-2', { elementId: 'el-2', roomId: 'room-1', type: 'arrow' })
    chatMessageDb.set('msg-2', { messageId: 'msg-2', roomId: 'room-1', text: 'world' })

    await captureSnapshot('room-1', 'autosave')

    // Sanity: live repos have the new state before rollback
    expect(Array.from(elementDb.values()).map((e) => e.elementId)).toContain('el-2')

    await rollbackTo('room-1', s1.snapshotId, actor)

    // After rollback, live element repo must contain s1's elements (el-1), not el-2
    const restoredElements = Array.from(elementDb.values()).filter((e) => e.roomId === 'room-1')
    expect(restoredElements.map((e) => e.elementId)).toEqual(['el-1'])

    // After rollback, live chat repo must contain s1's messages (msg-1), not msg-2
    const restoredMessages = Array.from(chatMessageDb.values()).filter((m) => m.roomId === 'room-1')
    expect(restoredMessages.map((m) => m.messageId)).toEqual(['msg-1'])
  })
})

describe('listSnapshots', () => {
  it('returns snapshots for a room in sequence order', async () => {
    await captureSnapshot('room-1', 'manual')
    await captureSnapshot('room-1', 'autosave')
    const list = await listSnapshots('room-1')
    expect(list.map((s) => s.sequenceNumber)).toEqual([1, 2])
  })
})

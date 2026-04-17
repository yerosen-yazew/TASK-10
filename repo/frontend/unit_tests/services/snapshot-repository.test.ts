// REQ: R17 — Snapshots retained (max 48), ordered oldest→newest

import { describe, it, expect, beforeEach } from 'vitest'
import { snapshotRepository } from '@/services/snapshot-repository'
import { DB_NAME, MAX_SNAPSHOTS_RETAINED } from '@/models/constants'
import type { Snapshot } from '@/models/snapshot'

async function resetDb() {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

function makeSnap(
  id: string,
  roomId: string,
  seq: number,
  createdAt: string,
): Snapshot {
  return {
    snapshotId: id,
    roomId,
    sequenceNumber: seq,
    createdAt,
    sizeBytes: 100,
    data: {
      elements: [],
      chatMessages: [],
      pinnedMessages: [],
      commentThreads: [],
      comments: [],
      members: [],
      activityEvents: [],
    },
  }
}

describe('snapshotRepository', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('listByRoom sorts ascending by createdAt', async () => {
    await snapshotRepository.put(makeSnap('s3', 'r1', 3, '2026-01-03T00:00:00.000Z'))
    await snapshotRepository.put(makeSnap('s1', 'r1', 1, '2026-01-01T00:00:00.000Z'))
    await snapshotRepository.put(makeSnap('s2', 'r1', 2, '2026-01-02T00:00:00.000Z'))
    const list = await snapshotRepository.listByRoom('r1')
    expect(list.map((s) => s.snapshotId)).toEqual(['s1', 's2', 's3'])
  })

  it('listByRoom breaks ties by sequenceNumber when createdAt is equal', async () => {
    await snapshotRepository.put(makeSnap('b', 'r1', 2, '2026-01-01T00:00:00.000Z'))
    await snapshotRepository.put(makeSnap('a', 'r1', 1, '2026-01-01T00:00:00.000Z'))
    const list = await snapshotRepository.listByRoom('r1')
    expect(list.map((s) => s.sequenceNumber)).toEqual([1, 2])
  })

  it('countByRoom matches the retention cap enforcement input', async () => {
    for (let i = 0; i < 4; i++) {
      await snapshotRepository.put(
        makeSnap(`s${i}`, 'r1', i, `2026-01-0${i + 1}T00:00:00.000Z`),
      )
    }
    const count = await snapshotRepository.countByRoom('r1')
    expect(count).toBe(4)
    expect(count).toBeLessThan(MAX_SNAPSHOTS_RETAINED)
  })

  it('deleteOldestExcess trims to the provided cap (oldest removed first)', async () => {
    for (let i = 1; i <= 5; i++) {
      await snapshotRepository.put(
        makeSnap(`s${i}`, 'r1', i, `2026-01-0${i}T00:00:00.000Z`),
      )
    }
    const removed = await snapshotRepository.deleteOldestExcess('r1', 3)
    expect(removed).toBe(2)
    const remaining = await snapshotRepository.listByRoom('r1')
    expect(remaining.map((s) => s.snapshotId)).toEqual(['s3', 's4', 's5'])
  })

  it('deleteOldestExcess is a no-op when below the cap', async () => {
    await snapshotRepository.put(makeSnap('s1', 'r1', 1, '2026-01-01T00:00:00.000Z'))
    expect(await snapshotRepository.deleteOldestExcess('r1', 10)).toBe(0)
  })
})

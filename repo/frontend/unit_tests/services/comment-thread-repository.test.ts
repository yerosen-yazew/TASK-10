// REQ: R7 — Comment thread persistence and element-anchored lookup

import { describe, it, expect, beforeEach } from 'vitest'
import { commentThreadRepository } from '@/services/comment-thread-repository'
import { DB_NAME } from '@/models/constants'
import type { CommentThread } from '@/models/comment'

async function resetDb() {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

function makeThread(
  threadId: string,
  roomId: string,
  elementId: string,
): CommentThread {
  return {
    threadId,
    roomId,
    elementId,
    commentCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastCommentAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('commentThreadRepository', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('put + getById roundtrips a thread', async () => {
    await commentThreadRepository.put(makeThread('t1', 'r1', 'el1'))
    expect((await commentThreadRepository.getById('t1'))?.elementId).toBe('el1')
  })

  it('listByRoom returns only threads for the given room', async () => {
    await commentThreadRepository.put(makeThread('t1', 'r1', 'el1'))
    await commentThreadRepository.put(makeThread('t2', 'r1', 'el2'))
    await commentThreadRepository.put(makeThread('t3', 'r2', 'el3'))
    const threads = await commentThreadRepository.listByRoom('r1')
    expect(threads.map((t) => t.threadId).sort()).toEqual(['t1', 't2'])
  })

  it('findByElement returns the thread anchored to an element', async () => {
    await commentThreadRepository.put(makeThread('t1', 'r1', 'el1'))
    const found = await commentThreadRepository.findByElement('r1', 'el1')
    expect(found?.threadId).toBe('t1')
  })

  it('findByElement returns undefined when the element has no thread', async () => {
    const found = await commentThreadRepository.findByElement('r1', 'missing')
    expect(found).toBeUndefined()
  })
})

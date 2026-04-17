// REQ: R7 — Comments per thread (200 max), by-room listing for backup export (Q13)

import { describe, it, expect, beforeEach } from 'vitest'
import { commentRepository } from '@/services/comment-repository'
import { DB_NAME, MAX_COMMENTS_PER_THREAD } from '@/models/constants'
import type { Comment } from '@/models/comment'

async function resetDb() {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

function makeComment(
  commentId: string,
  threadId: string,
  roomId: string,
  createdAt: string,
): Comment {
  return {
    commentId,
    threadId,
    roomId,
    authorId: 'author-1',
    authorDisplayName: 'Alex',
    text: `comment ${commentId}`,
    mentions: [],
    createdAt,
    updatedAt: createdAt,
    isEdited: false,
    isDeleted: false,
  }
}

describe('commentRepository', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('put + getById roundtrips a comment', async () => {
    await commentRepository.put(makeComment('c1', 't1', 'r1', '2026-01-01T00:00:00.000Z'))
    expect((await commentRepository.getById('c1'))?.text).toBe('comment c1')
  })

  it('listByThread returns comments sorted by createdAt', async () => {
    await commentRepository.put(makeComment('c2', 't1', 'r1', '2026-01-02T00:00:00.000Z'))
    await commentRepository.put(makeComment('c1', 't1', 'r1', '2026-01-01T00:00:00.000Z'))
    await commentRepository.put(makeComment('c3', 't1', 'r1', '2026-01-03T00:00:00.000Z'))
    const list = await commentRepository.listByThread('t1')
    expect(list.map((c) => c.commentId)).toEqual(['c1', 'c2', 'c3'])
  })

  it('listByThread returns only comments for the requested thread', async () => {
    await commentRepository.put(makeComment('a', 't1', 'r1', '2026-01-01T00:00:00.000Z'))
    await commentRepository.put(makeComment('b', 't2', 'r1', '2026-01-01T00:00:01.000Z'))
    const list = await commentRepository.listByThread('t1')
    expect(list.length).toBe(1)
    expect(list[0].commentId).toBe('a')
  })

  it('countByThread is used for the 200-comment cap check', async () => {
    for (let i = 0; i < 5; i++) {
      await commentRepository.put(
        makeComment(`c${i}`, 't1', 'r1', `2026-01-01T00:00:0${i}.000Z`),
      )
    }
    const count = await commentRepository.countByThread('t1')
    expect(count).toBe(5)
    expect(count).toBeLessThan(MAX_COMMENTS_PER_THREAD)
  })

  it('listByRoom returns every comment for a room (used by backup export)', async () => {
    await commentRepository.put(makeComment('a', 't1', 'r1', '2026-01-01T00:00:00.000Z'))
    await commentRepository.put(makeComment('b', 't2', 'r1', '2026-01-01T00:00:01.000Z'))
    await commentRepository.put(makeComment('c', 't3', 'r2', '2026-01-01T00:00:02.000Z'))
    const list = await commentRepository.listByRoom('r1')
    expect(list.map((c) => c.commentId).sort()).toEqual(['a', 'b'])
  })

  it('listByRoom returns an empty array when the room has no comments', async () => {
    expect(await commentRepository.listByRoom('empty')).toEqual([])
  })
})

// REQ: R7 — Threaded comments (200 per thread) with @mention resolution
// REQ: Q4 — mention resolution active-first, non-active marked, left-users visible in history

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createThread,
  appendComment,
  resolveMentions,
  applyCommentMutation,
} from '@/engine/comment-engine'
import type { Comment, CommentThread } from '@/models/comment'
import { MembershipState, RoomRole, type MemberRecord } from '@/models/room'
import type { ActivityEvent } from '@/models/activity'
import { ActivityEventType } from '@/models/activity'

const threadStore = new Map<string, CommentThread>()
const commentStore = new Map<string, Comment>()
const activityStore: ActivityEvent[] = []

vi.mock('@/services/comment-thread-repository', () => ({
  commentThreadRepository: {
    put: vi.fn(async (t: CommentThread) => {
      threadStore.set(t.threadId, t)
    }),
    getById: vi.fn(async (id: string) => threadStore.get(id)),
    findByElement: vi.fn(async (roomId: string, elementId: string) =>
      Array.from(threadStore.values()).find(
        (t) => t.roomId === roomId && t.elementId === elementId
      )
    ),
    listByRoom: vi.fn(async (roomId: string) =>
      Array.from(threadStore.values()).filter((t) => t.roomId === roomId)
    ),
  },
}))

vi.mock('@/services/comment-repository', () => ({
  commentRepository: {
    put: vi.fn(async (c: Comment) => {
      commentStore.set(c.commentId, c)
    }),
    listByThread: vi.fn(async (threadId: string) =>
      Array.from(commentStore.values())
        .filter((c) => c.threadId === threadId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    ),
    countByThread: vi.fn(async (threadId: string) =>
      Array.from(commentStore.values()).filter((c) => c.threadId === threadId).length
    ),
  },
}))

vi.mock('@/services/activity-repository', () => ({
  activityRepository: {
    put: vi.fn(async (e: ActivityEvent) => {
      activityStore.push(e)
    }),
  },
}))

beforeEach(() => {
  threadStore.clear()
  commentStore.clear()
  activityStore.length = 0
})

function makeMember(
  memberId: string,
  displayName: string,
  state: MembershipState
): MemberRecord {
  const now = new Date().toISOString()
  return {
    roomId: 'room-1',
    memberId,
    displayName,
    avatarColor: '#000',
    role: RoomRole.Participant,
    state,
    joinedAt: now,
    stateChangedAt: now,
    approvals: [],
  }
}

describe('createThread', () => {
  it('creates a new thread with the starter comment and emits CommentAdded', async () => {
    const result = await createThread({
      roomId: 'room-1',
      elementId: 'el-1',
      starter: {
        authorId: 'u-1',
        authorDisplayName: 'Alice',
        text: 'first!',
      },
    })
    expect(result.validation.valid).toBe(true)
    expect(result.thread?.elementId).toBe('el-1')
    expect(result.thread?.commentCount).toBe(1)
    expect(result.comment?.text).toBe('first!')
    expect(activityStore.some((e) => e.type === ActivityEventType.CommentAdded)).toBe(true)
  })

  it('rejects a duplicate thread on the same element', async () => {
    await createThread({
      roomId: 'room-1',
      elementId: 'el-1',
      starter: { authorId: 'u-1', authorDisplayName: 'Alice', text: 'a' },
    })
    const dup = await createThread({
      roomId: 'room-1',
      elementId: 'el-1',
      starter: { authorId: 'u-1', authorDisplayName: 'Alice', text: 'b' },
    })
    expect(dup.validation.valid).toBe(false)
    expect(dup.validation.errors[0].code).toBe('duplicate')
  })
})

describe('appendComment', () => {
  it('appends a comment and bumps thread.commentCount + emits activity', async () => {
    const thread = await createThread({
      roomId: 'room-1',
      elementId: 'el-1',
      starter: { authorId: 'u-1', authorDisplayName: 'Alice', text: 'a' },
    })
    activityStore.length = 0
    const result = await appendComment({
      threadId: thread.thread!.threadId,
      authorId: 'u-2',
      authorDisplayName: 'Bob',
      text: 'b',
    })
    expect(result.validation.valid).toBe(true)
    expect(result.thread?.commentCount).toBe(2)
    expect(activityStore.some((e) => e.type === ActivityEventType.CommentAdded)).toBe(true)
  })

  it('returns not_found for an unknown thread', async () => {
    const result = await appendComment({
      threadId: 'missing',
      authorId: 'u-1',
      authorDisplayName: 'Alice',
      text: 'a',
    })
    expect(result.validation.valid).toBe(false)
    expect(result.validation.errors[0].code).toBe('not_found')
  })

  it('rejects the 201st comment in a thread', async () => {
    const thread: CommentThread = {
      threadId: 'thread-1',
      roomId: 'room-1',
      elementId: 'el-1',
      commentCount: 200,
      createdAt: new Date().toISOString(),
      lastCommentAt: new Date().toISOString(),
    }
    threadStore.set(thread.threadId, thread)
    for (let i = 0; i < 200; i++) {
      commentStore.set(`c-${i}`, {
        commentId: `c-${i}`,
        threadId: 'thread-1',
        roomId: 'room-1',
        authorId: 'u-1',
        authorDisplayName: 'Alice',
        text: `x${i}`,
        mentions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isEdited: false,
        isDeleted: false,
      })
    }
    const result = await appendComment({
      threadId: 'thread-1',
      authorId: 'u-2',
      authorDisplayName: 'Bob',
      text: 'overflow',
    })
    expect(result.validation.valid).toBe(false)
    expect(result.validation.errors[0].code).toBe('max_count')
  })
})

describe('resolveMentions', () => {
  it('ranks active members first, alphabetical within group', () => {
    const members = [
      makeMember('u-1', 'Zed', MembershipState.Active),
      makeMember('u-2', 'Alan', MembershipState.Active),
    ]
    const result = resolveMentions('', members)
    expect(result[0].displayName).toBe('Alan')
    expect(result[1].displayName).toBe('Zed')
    expect(result.every((c) => c.isActive)).toBe(true)
  })

  it('marks non-active members via the isActive flag', () => {
    const members = [
      makeMember('u-1', 'Alice', MembershipState.Active),
      makeMember('u-2', 'Bob', MembershipState.Left),
    ]
    const result = resolveMentions('', members, new Set(['u-2']))
    const bob = result.find((c) => c.memberId === 'u-2')
    expect(bob).toBeTruthy()
    expect(bob?.isActive).toBe(false)
    expect(bob?.state).toBe(MembershipState.Left)
    // Active always appears before non-active
    expect(result[0].memberId).toBe('u-1')
  })

  it('keeps a left member visible only when present in retained history', () => {
    const members = [
      makeMember('u-1', 'Alice', MembershipState.Active),
      makeMember('u-2', 'Bob', MembershipState.Left),
    ]
    const withoutHistory = resolveMentions('', members)
    expect(withoutHistory.find((c) => c.memberId === 'u-2')).toBeUndefined()
    const withHistory = resolveMentions('', members, new Set(['u-2']))
    expect(withHistory.find((c) => c.memberId === 'u-2')).toBeTruthy()
  })

  it('filters by display-name substring (case-insensitive)', () => {
    const members = [
      makeMember('u-1', 'Alice', MembershipState.Active),
      makeMember('u-2', 'Bob', MembershipState.Active),
      makeMember('u-3', 'Alina', MembershipState.Active),
    ]
    const result = resolveMentions('al', members)
    expect(result.map((c) => c.memberId).sort()).toEqual(['u-1', 'u-3'])
  })
})

describe('applyCommentMutation', () => {
  it('applies remote create-thread payload with thread and starter comment', async () => {
    const now = new Date().toISOString()
    const result = await applyCommentMutation('room-1', {
      operation: 'create-thread',
      threadId: 'thread-remote',
      elementId: 'el-remote',
      thread: {
        threadId: 'thread-remote',
        roomId: 'room-1',
        elementId: 'el-remote',
        commentCount: 1,
        createdAt: now,
        lastCommentAt: now,
      },
      comment: {
        commentId: 'comment-remote',
        threadId: 'thread-remote',
        roomId: 'room-1',
        authorId: 'peer-1',
        authorDisplayName: 'Peer',
        text: 'hello',
        mentions: [],
        createdAt: now,
        updatedAt: now,
        isEdited: false,
        isDeleted: false,
      },
    })

    expect(result.valid).toBe(true)
    expect(threadStore.has('thread-remote')).toBe(true)
    expect(commentStore.has('comment-remote')).toBe(true)
  })

  it('updates thread count on remote append-comment payload', async () => {
    const now = new Date().toISOString()
    threadStore.set('thread-1', {
      threadId: 'thread-1',
      roomId: 'room-1',
      elementId: 'el-1',
      commentCount: 1,
      createdAt: now,
      lastCommentAt: now,
    })
    commentStore.set('existing-c', {
      commentId: 'existing-c',
      threadId: 'thread-1',
      roomId: 'room-1',
      authorId: 'u-1',
      authorDisplayName: 'Alice',
      text: 'seed',
      mentions: [],
      createdAt: now,
      updatedAt: now,
      isEdited: false,
      isDeleted: false,
    })

    const result = await applyCommentMutation('room-1', {
      operation: 'append-comment',
      threadId: 'thread-1',
      elementId: 'el-1',
      comment: {
        commentId: 'new-c',
        threadId: 'thread-1',
        roomId: 'room-1',
        authorId: 'peer-1',
        authorDisplayName: 'Peer',
        text: 'new',
        mentions: [],
        createdAt: now,
        updatedAt: now,
        isEdited: false,
        isDeleted: false,
      },
    })

    expect(result.valid).toBe(true)
    expect(threadStore.get('thread-1')?.commentCount).toBe(2)
  })
})

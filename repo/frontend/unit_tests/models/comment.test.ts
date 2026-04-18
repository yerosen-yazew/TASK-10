// REQ: comment model mention/thread fixtures

import { describe, expect, it } from 'vitest'
import type { Mention, Comment, CommentThread } from '@/models/comment'

describe('comment model', () => {
  it('accepts mention fixtures', () => {
    const mention: Mention = {
      memberId: 'member-2',
      displayName: 'Reviewer',
      startOffset: 6,
      endOffset: 15,
    }

    expect(mention.endOffset).toBeGreaterThan(mention.startOffset)
  })

  it('accepts comment and thread fixtures', () => {
    const thread: CommentThread = {
      threadId: 'thread-1',
      roomId: 'room-1',
      elementId: 'el-1',
      commentCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      lastCommentAt: '2026-01-01T00:00:00.000Z',
    }

    const comment: Comment = {
      commentId: 'comment-1',
      threadId: thread.threadId,
      roomId: 'room-1',
      authorId: 'member-1',
      authorDisplayName: 'Host',
      text: 'Looks good',
      mentions: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      isEdited: false,
      isDeleted: false,
    }

    expect(comment.threadId).toBe(thread.threadId)
    expect(comment.isDeleted).toBe(false)
  })
})

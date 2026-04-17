// REQ: R7 — Thin harness exposing comment engine to UI

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Comment, CommentThread } from '@/models/comment'
import type { MemberRecord } from '@/models/room'
import * as commentEngine from '@/engine/comment-engine'
import { commentThreadRepository } from '@/services/comment-thread-repository'
import { publishElement } from '@/services/collab-publisher'
import { publishComment } from '@/services/collab-publisher'
import { logger } from '@/utils/logger'

export const useCommentStore = defineStore('comment', () => {
  const threads = ref<CommentThread[]>([])
  const commentsByThread = ref<Record<string, Comment[]>>({})
  const isLoading = ref(false)
  const lastError = ref<string | null>(null)

  async function loadThreads(roomId: string): Promise<void> {
    isLoading.value = true
    lastError.value = null
    try {
      threads.value = await commentThreadRepository.listByRoom(roomId)
    } catch (err) {
      logger.error('Failed to load threads', { roomId, err })
      lastError.value = 'Failed to load comment threads.'
    } finally {
      isLoading.value = false
    }
  }

  async function loadComments(threadId: string): Promise<void> {
    const list = await commentEngine.listComments(threadId)
    commentsByThread.value = { ...commentsByThread.value, [threadId]: list }
  }

  async function createThread(input: commentEngine.CreateThreadInput) {
    const result = await commentEngine.createThread(input)
    if (result.thread) {
      threads.value.push(result.thread)
    }
    if (result.thread && result.comment) {
      commentsByThread.value[result.thread.threadId] = [result.comment]
      publishElement(
        result.thread.roomId,
        'update',
        result.thread.elementId,
        result.comment.authorId
      )
      publishComment(
        result.thread.roomId,
        'create-thread',
        result.thread.threadId,
        result.thread.elementId,
        result.comment.authorId,
        result.thread,
        result.comment
      )
    }
    return result
  }

  async function appendComment(input: commentEngine.AppendCommentInput) {
    const result = await commentEngine.appendComment(input)
    if (result.thread) {
      const idx = threads.value.findIndex((t) => t.threadId === result.thread!.threadId)
      if (idx !== -1) threads.value.splice(idx, 1, result.thread)
    }
    if (result.comment && result.thread) {
      const existing = commentsByThread.value[result.comment.threadId] ?? []
      commentsByThread.value[result.comment.threadId] = [...existing, result.comment]
      publishElement(
        result.thread.roomId,
        'update',
        result.thread.elementId,
        result.comment.authorId
      )
      publishComment(
        result.thread.roomId,
        'append-comment',
        result.thread.threadId,
        result.thread.elementId,
        result.comment.authorId,
        result.thread,
        result.comment
      )
    }
    return result
  }

  function resolveMentions(
    query: string,
    members: MemberRecord[],
    historicalIds: ReadonlySet<string> = new Set()
  ) {
    return commentEngine.resolveMentions(query, members, historicalIds)
  }

  return {
    threads,
    commentsByThread,
    isLoading,
    lastError,
    loadThreads,
    loadComments,
    createThread,
    appendComment,
    resolveMentions,
  }
})

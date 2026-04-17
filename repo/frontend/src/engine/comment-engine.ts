// REQ: R7 — Threaded comments (200 per thread) with local @mention resolution
// REQ: Q4 — mention resolution active-first, non-active marked, left-users visible in retained history

import type { ValidationResult } from '@/models/validation'
import { invalidResult, validResult } from '@/models/validation'
import { validateCommentCount } from '@/validators/comment-validators'
import type { Comment, CommentThread, Mention } from '@/models/comment'
import { MembershipState, type MemberRecord } from '@/models/room'
import { commentThreadRepository } from '@/services/comment-thread-repository'
import { commentRepository } from '@/services/comment-repository'
import { generateId } from '@/utils/id-generator'
import { nowISO } from '@/utils/date-utils'
import { emitActivity, type ActivityActor } from './activity-engine'
import { ActivityEventType } from '@/models/activity'
import type { CommentOpPayload } from '@/models/collaboration'

export interface CreateThreadInput {
  roomId: string
  elementId: string
  starter: {
    authorId: string
    authorDisplayName: string
    text: string
    mentions?: Mention[]
  }
}

export interface CommentResult {
  validation: ValidationResult
  thread?: CommentThread
  comment?: Comment
}

/** Create a comment thread for an element with an initial comment. */
export async function createThread(input: CreateThreadInput): Promise<CommentResult> {
  const existing = await commentThreadRepository.findByElement(input.roomId, input.elementId)
  if (existing) {
    return {
      validation: invalidResult(
        'threadId',
        'A thread already exists for this element.',
        'duplicate',
        input.elementId
      ),
    }
  }

  const now = nowISO()
  const thread: CommentThread = {
    threadId: generateId(),
    roomId: input.roomId,
    elementId: input.elementId,
    commentCount: 1,
    createdAt: now,
    lastCommentAt: now,
  }
  const comment: Comment = {
    commentId: generateId(),
    threadId: thread.threadId,
    roomId: input.roomId,
    authorId: input.starter.authorId,
    authorDisplayName: input.starter.authorDisplayName,
    text: input.starter.text,
    mentions: input.starter.mentions ?? [],
    createdAt: now,
    updatedAt: now,
    isEdited: false,
    isDeleted: false,
  }
  await commentThreadRepository.put(thread)
  await commentRepository.put(comment)
  await emitActivity(
    input.roomId,
    ActivityEventType.CommentAdded,
    { memberId: comment.authorId, displayName: comment.authorDisplayName },
    `Started a comment thread`,
    { targetId: thread.threadId, targetType: 'comment' },
    { elementId: input.elementId }
  )
  return { validation: validResult(), thread, comment }
}

export interface AppendCommentInput {
  threadId: string
  authorId: string
  authorDisplayName: string
  text: string
  mentions?: Mention[]
}

/** Append a comment to an existing thread. Enforces the 200-cap. */
export async function appendComment(input: AppendCommentInput): Promise<CommentResult> {
  const thread = await commentThreadRepository.getById(input.threadId)
  if (!thread) {
    return {
      validation: invalidResult('threadId', 'Thread not found.', 'not_found', input.threadId),
    }
  }
  const currentCount = await commentRepository.countByThread(input.threadId)
  const cap = validateCommentCount(currentCount)
  if (!cap.valid) return { validation: cap }

  const now = nowISO()
  const comment: Comment = {
    commentId: generateId(),
    threadId: input.threadId,
    roomId: thread.roomId,
    authorId: input.authorId,
    authorDisplayName: input.authorDisplayName,
    text: input.text,
    mentions: input.mentions ?? [],
    createdAt: now,
    updatedAt: now,
    isEdited: false,
    isDeleted: false,
  }
  await commentRepository.put(comment)

  const updatedThread: CommentThread = {
    ...thread,
    commentCount: currentCount + 1,
    lastCommentAt: now,
  }
  await commentThreadRepository.put(updatedThread)

  const actor: ActivityActor = {
    memberId: comment.authorId,
    displayName: comment.authorDisplayName,
  }
  await emitActivity(
    thread.roomId,
    ActivityEventType.CommentAdded,
    actor,
    `Commented on a thread`,
    { targetId: thread.threadId, targetType: 'comment' },
    { elementId: thread.elementId }
  )

  return { validation: validResult(), thread: updatedThread, comment }
}

/** List comments in a thread (chronological). */
export async function listComments(threadId: string): Promise<Comment[]> {
  return commentRepository.listByThread(threadId)
}

// ── Mention resolution ──────────────────────────────────────────────────────

export interface MentionCandidate {
  memberId: string
  displayName: string
  isActive: boolean
  /** The membership state at resolution time — helpful for marking non-active users. */
  state: MembershipState
}

/**
 * Resolve mention suggestions against the room people list for a given query.
 *
 * Q4 decision: mention suggestions resolve against the locally-known member
 * directory, ranking active members first and marking non-active identities.
 * Left/rejected members stay searchable only when they still appear in retained
 * activity/comment history (caller passes their memberIds via `historicalIds`).
 */
export function resolveMentions(
  query: string,
  members: MemberRecord[],
  historicalIds: ReadonlySet<string> = new Set()
): MentionCandidate[] {
  const q = query.trim().toLowerCase()
  const candidates: MentionCandidate[] = []
  const seen = new Set<string>()
  for (const m of members) {
    if (seen.has(m.memberId)) continue
    seen.add(m.memberId)

    const isActive = m.state === MembershipState.Active
    const isHistorical =
      (m.state === MembershipState.Left || m.state === MembershipState.Rejected) &&
      historicalIds.has(m.memberId)

    // Filter: active members are always considered; others only if they still have history.
    if (!isActive && !isHistorical) continue

    if (q.length > 0 && !m.displayName.toLowerCase().includes(q)) continue

    candidates.push({
      memberId: m.memberId,
      displayName: m.displayName,
      isActive,
      state: m.state,
    })
  }
  // Active first, then alphabetical within each group for stable ordering.
  candidates.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
    return a.displayName.localeCompare(b.displayName)
  })
  return candidates
}

/**
 * Apply an inbound WebRTC comment mutation payload to local IndexedDB.
 * This path intentionally avoids generating local activity records.
 */
export async function applyCommentMutation(
  roomId: string,
  payload: CommentOpPayload
): Promise<ValidationResult> {
  if (!payload.threadId) {
    return invalidResult('threadId', 'Missing thread id in collaboration payload.', 'required')
  }

  if (payload.thread) {
    if (payload.thread.roomId !== roomId) {
      return invalidResult('roomId', 'Comment thread payload room mismatch.', 'invalid')
    }
    await commentThreadRepository.put(payload.thread)
  }

  if (payload.comment) {
    if (payload.comment.roomId !== roomId) {
      return invalidResult('roomId', 'Comment payload room mismatch.', 'invalid')
    }
    await commentRepository.put(payload.comment)
  }

  if (payload.operation === 'append-comment') {
    const thread = await commentThreadRepository.getById(payload.threadId)
    if (thread) {
      const count = await commentRepository.countByThread(payload.threadId)
      await commentThreadRepository.put({
        ...thread,
        commentCount: count,
        lastCommentAt: payload.comment?.createdAt ?? nowISO(),
      })
    }
  }

  return validResult()
}

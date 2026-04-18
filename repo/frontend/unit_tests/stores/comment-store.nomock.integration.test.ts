import { beforeEach, describe, expect, it } from 'vitest'
import { useCommentStore } from '@/stores/comment-store'
import { setupNoMockTestEnv, seedActiveHostRoom, seedActiveSessionProfile } from '../integration/no-mock-test-harness'
import { commentThreadRepository } from '@/services/comment-thread-repository'
import { commentRepository } from '@/services/comment-repository'
import { MembershipState, RoomRole, type MemberRecord } from '@/models/room'

const isoNow = () => new Date().toISOString()

describe('comment-store no-mock integration', () => {
  beforeEach(async () => {
    await setupNoMockTestEnv()
  })

  it('loads empty thread list for room without comments', async () => {
    const { room } = await seedActiveHostRoom()
    const store = useCommentStore()

    await store.loadThreads(room.roomId)

    expect(store.threads.length).toBe(0)
    expect(store.lastError).toBeNull()
  })

  it('creates a new comment thread and caches starter comment', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useCommentStore()

    const created = await store.createThread({
      roomId: room.roomId,
      elementId: 'element-1',
      starter: {
        authorId: host.profileId,
        authorDisplayName: host.displayName,
        text: 'starter comment',
      },
    })

    expect(created.validation.valid).toBe(true)
    expect(store.threads.length).toBe(1)
    expect(store.commentsByThread[created.thread!.threadId].length).toBe(1)
  })

  it('rejects duplicate thread for same element', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useCommentStore()

    await store.createThread({
      roomId: room.roomId,
      elementId: 'element-dup',
      starter: {
        authorId: host.profileId,
        authorDisplayName: host.displayName,
        text: 'first',
      },
    })

    const duplicate = await store.createThread({
      roomId: room.roomId,
      elementId: 'element-dup',
      starter: {
        authorId: host.profileId,
        authorDisplayName: host.displayName,
        text: 'second',
      },
    })

    expect(duplicate.validation.valid).toBe(false)
    expect(duplicate.validation.errors[0]?.code).toBe('duplicate')
  })

  it('appendComment updates thread count and cache', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useCommentStore()

    const created = await store.createThread({
      roomId: room.roomId,
      elementId: 'element-2',
      starter: {
        authorId: host.profileId,
        authorDisplayName: host.displayName,
        text: 'thread start',
      },
    })

    const appended = await store.appendComment({
      threadId: created.thread!.threadId,
      authorId: host.profileId,
      authorDisplayName: host.displayName,
      text: 'follow up',
    })

    expect(appended.validation.valid).toBe(true)
    expect(store.commentsByThread[created.thread!.threadId].length).toBe(2)
    expect(store.threads[0].commentCount).toBe(2)
  })

  it('appendComment fails for unknown thread', async () => {
    const { host } = await seedActiveHostRoom()
    const store = useCommentStore()

    const result = await store.appendComment({
      threadId: 'missing-thread',
      authorId: host.profileId,
      authorDisplayName: host.displayName,
      text: 'orphan comment',
    })

    expect(result.validation.valid).toBe(false)
    expect(result.validation.errors[0]?.code).toBe('not_found')
  })

  it('loadComments reads persisted comments by thread', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useCommentStore()

    const created = await store.createThread({
      roomId: room.roomId,
      elementId: 'element-3',
      starter: {
        authorId: host.profileId,
        authorDisplayName: host.displayName,
        text: 'first',
      },
    })

    await store.appendComment({
      threadId: created.thread!.threadId,
      authorId: host.profileId,
      authorDisplayName: host.displayName,
      text: 'second',
    })

    const fresh = useCommentStore()
    await fresh.loadComments(created.thread!.threadId)

    expect(fresh.commentsByThread[created.thread!.threadId].length).toBe(2)
  })

  it('persists thread rows in repository after create', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useCommentStore()

    const created = await store.createThread({
      roomId: room.roomId,
      elementId: 'element-4',
      starter: {
        authorId: host.profileId,
        authorDisplayName: host.displayName,
        text: 'persisted starter',
      },
    })

    const persisted = await commentThreadRepository.getById(created.thread!.threadId)
    expect(persisted?.elementId).toBe('element-4')
  })

  it('persists appended comment rows in repository', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useCommentStore()

    const created = await store.createThread({
      roomId: room.roomId,
      elementId: 'element-5',
      starter: {
        authorId: host.profileId,
        authorDisplayName: host.displayName,
        text: 'starter',
      },
    })

    const appended = await store.appendComment({
      threadId: created.thread!.threadId,
      authorId: host.profileId,
      authorDisplayName: host.displayName,
      text: 'persisted append',
    })

    const persisted = await commentRepository.getById(appended.comment!.commentId)
    expect(persisted?.text).toBe('persisted append')
  })

  it('stores mentions on appended comments', async () => {
    const { room, host } = await seedActiveHostRoom()
    const mentioned = await seedActiveSessionProfile({ displayName: 'Mention Target' })
    const store = useCommentStore()

    const created = await store.createThread({
      roomId: room.roomId,
      elementId: 'element-mentions',
      starter: {
        authorId: host.profileId,
        authorDisplayName: host.displayName,
        text: 'starter',
      },
    })

    const appended = await store.appendComment({
      threadId: created.thread!.threadId,
      authorId: host.profileId,
      authorDisplayName: host.displayName,
      text: '@Mention Target please review',
      mentions: [{ memberId: mentioned.profileId, displayName: mentioned.displayName, startOffset: 0, endOffset: 14 }],
    })

    expect(appended.comment?.mentions.length).toBe(1)
    expect(appended.comment?.mentions[0].memberId).toBe(mentioned.profileId)
  })

  it('resolveMentions returns active users before historical left users', async () => {
    const store = useCommentStore()
    const members: MemberRecord[] = [
      {
        roomId: 'room-1',
        memberId: 'left-1',
        displayName: 'Alex Left',
        avatarColor: '#ef4444',
        role: RoomRole.Participant,
        state: MembershipState.Left,
        joinedAt: isoNow(),
        stateChangedAt: isoNow(),
        approvals: [],
      },
      {
        roomId: 'room-1',
        memberId: 'active-1',
        displayName: 'Alex Active',
        avatarColor: '#22c55e',
        role: RoomRole.Host,
        state: MembershipState.Active,
        joinedAt: isoNow(),
        stateChangedAt: isoNow(),
        approvals: [],
      },
    ]

    const result = store.resolveMentions('alex', members, new Set(['left-1']))

    expect(result.length).toBe(2)
    expect(result[0].memberId).toBe('active-1')
    expect(result[1].memberId).toBe('left-1')
  })

  it('resolveMentions excludes non-historical left users', async () => {
    const store = useCommentStore()
    const members: MemberRecord[] = [
      {
        roomId: 'room-1',
        memberId: 'left-2',
        displayName: 'Chris Left',
        avatarColor: '#ef4444',
        role: RoomRole.Participant,
        state: MembershipState.Left,
        joinedAt: isoNow(),
        stateChangedAt: isoNow(),
        approvals: [],
      },
      {
        roomId: 'room-1',
        memberId: 'active-2',
        displayName: 'Chris Active',
        avatarColor: '#22c55e',
        role: RoomRole.Participant,
        state: MembershipState.Active,
        joinedAt: isoNow(),
        stateChangedAt: isoNow(),
        approvals: [],
      },
    ]

    const result = store.resolveMentions('chris', members)

    expect(result.map((m) => m.memberId)).toEqual(['active-2'])
  })

  it('resolveMentions filters results by query substring', async () => {
    const store = useCommentStore()
    const members: MemberRecord[] = [
      {
        roomId: 'room-1',
        memberId: 'm-1',
        displayName: 'Alice',
        avatarColor: '#22c55e',
        role: RoomRole.Participant,
        state: MembershipState.Active,
        joinedAt: isoNow(),
        stateChangedAt: isoNow(),
        approvals: [],
      },
      {
        roomId: 'room-1',
        memberId: 'm-2',
        displayName: 'Bob',
        avatarColor: '#22c55e',
        role: RoomRole.Participant,
        state: MembershipState.Active,
        joinedAt: isoNow(),
        stateChangedAt: isoNow(),
        approvals: [],
      },
    ]

    const result = store.resolveMentions('ali', members)

    expect(result.length).toBe(1)
    expect(result[0].displayName).toBe('Alice')
  })
})

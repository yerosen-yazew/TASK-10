// REQ: R20 — Backup export/import (≤200 MB, row validation, 1K cap)

import type { BackupManifest } from '@/models/backup'
import type { Room, MemberRecord } from '@/models/room'
import type { WhiteboardElement } from '@/models/element'
import type { CommentThread, Comment } from '@/models/comment'
import type { ChatMessage, PinnedMessage } from '@/models/chat'
import type { ActivityEvent } from '@/models/activity'
import type { Snapshot } from '@/models/snapshot'
import type { BackupImageReference } from '@/models/backup'
import { BACKUP_FORMAT } from '@/models/constants'
import { nowISO } from '@/utils/date-utils'
import { estimateJsonSize } from '@/utils/size-utils'

/** Input data for building a backup manifest. */
export interface BackupBuildInput {
  room: Room
  members: MemberRecord[]
  elements: WhiteboardElement[]
  images: BackupImageReference[]
  commentThreads: CommentThread[]
  comments: Comment[]
  chatMessages: ChatMessage[]
  pinnedMessages: PinnedMessage[]
  activityFeed: ActivityEvent[]
  snapshots: Snapshot[]
  exportedBy: string
}

/**
 * Build a complete BackupManifest from room data.
 */
export function buildBackupManifest(input: BackupBuildInput): BackupManifest {
  const manifest: BackupManifest = {
    version: 1,
    exportedAt: nowISO(),
    exportedBy: input.exportedBy,
    roomId: input.room.roomId,
    roomName: input.room.name,
    format: BACKUP_FORMAT,
    data: {
      room: input.room,
      members: input.members,
      elements: input.elements,
      images: input.images,
      commentThreads: input.commentThreads,
      comments: input.comments,
      chatMessages: input.chatMessages,
      pinnedMessages: input.pinnedMessages,
      activityFeed: input.activityFeed,
      snapshots: input.snapshots,
    },
    stats: {
      totalElements: input.elements.length,
      totalImages: input.images.length,
      totalComments: input.comments.length,
      totalChatMessages: input.chatMessages.length,
      totalSnapshots: input.snapshots.length,
      fileSizeBytes: 0,
    },
  }

  // Calculate file size after building the full manifest
  manifest.stats.fileSizeBytes = estimateJsonSize(manifest)

  return manifest
}

/**
 * Serialize a backup manifest to a JSON string.
 */
export function serializeBackup(manifest: BackupManifest): string {
  return JSON.stringify(manifest)
}

/**
 * Deserialize a JSON string to a BackupManifest.
 * Returns null if parsing fails.
 */
export function deserializeBackup(json: string): BackupManifest | null {
  try {
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.format !== BACKUP_FORMAT) return null
    if (parsed.version !== 1) return null
    return parsed as BackupManifest
  } catch {
    return null
  }
}

/**
 * Estimate the byte size of a backup that would be generated from the given input.
 * Useful for pre-export size checking without full serialization.
 */
export function estimateBackupSize(input: BackupBuildInput): number {
  return estimateJsonSize(input)
}

// REQ: R20 — Backup export/import (≤200 MB, row validation, 1K bulk import cap)

import type { Room, MemberRecord } from './room'
import type { WhiteboardElement, ImageRecord } from './element'
import type { Comment, CommentThread } from './comment'
import type { ChatMessage, PinnedMessage } from './chat'
import type { ActivityEvent } from './activity'
import type { Snapshot } from './snapshot'
import { BACKUP_FORMAT } from './constants'

/** Image reference in a backup file (blob encoded as base64). */
export interface BackupImageReference {
  imageId: string
  elementId: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
  /** Base64-encoded image blob data. */
  base64Data: string
}

/** Full backup manifest for export/import. */
export interface BackupManifest {
  version: 1
  exportedAt: string            // ISO 8601
  exportedBy: string            // profile display name
  roomId: string
  roomName: string
  format: typeof BACKUP_FORMAT
  data: {
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
  }
  stats: {
    totalElements: number
    totalImages: number
    totalComments: number
    totalChatMessages: number
    totalSnapshots: number
    fileSizeBytes: number
  }
}

/** Row types that can appear in import validation errors. */
export type ImportRowType = 'element' | 'comment' | 'chat-message' | 'member' | 'image'

/** A single row-level validation error during import. */
export interface ImportRowError {
  rowIndex: number
  rowType: ImportRowType
  field?: string
  error: string
  rawValue?: unknown
}

/** Result of validating an import file. */
export interface ImportValidationResult {
  success: boolean
  totalRows: number
  validRows: number
  errorRows: ImportRowError[]
  warnings: string[]
  /** True if the batch cap (1,000 sticky notes + comments) was hit. */
  truncated: boolean
}

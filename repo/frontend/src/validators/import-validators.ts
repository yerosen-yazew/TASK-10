// REQ: R20 — Backup export/import (≤200 MB, row validation, 1K bulk import cap)

import {
  MAX_BACKUP_SIZE_BYTES,
  MAX_BULK_IMPORT_ITEMS,
  BACKUP_FORMAT,
} from '@/models/constants'
import type { ValidationResult } from '@/models/validation'
import { validResult, invalidResult } from '@/models/validation'
import type { ImportRowError, ImportValidationResult } from '@/models/backup'

/**
 * Validate that a backup file does not exceed the maximum size.
 * @param fileSizeBytes Size of the file in bytes.
 */
export function validateBackupFileSize(fileSizeBytes: number): ValidationResult {
  if (fileSizeBytes > MAX_BACKUP_SIZE_BYTES) {
    return invalidResult(
      'fileSize',
      `Backup file exceeds the maximum size of 200 MB (${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB).`,
      'max_size',
      fileSizeBytes
    )
  }
  return validResult()
}

/**
 * Validate that a bulk import batch does not exceed the item cap.
 * @param stickyNoteCount Number of sticky notes in the batch.
 * @param commentCount Number of comments in the batch.
 */
export function validateBulkImportCap(stickyNoteCount: number, commentCount: number): ValidationResult {
  const total = stickyNoteCount + commentCount
  if (total > MAX_BULK_IMPORT_ITEMS) {
    return invalidResult(
      'bulkImportCount',
      `Batch contains ${total} sticky notes + comments, exceeding the limit of ${MAX_BULK_IMPORT_ITEMS}.`,
      'cap_exceeded',
      total
    )
  }
  return validResult()
}

/**
 * Validate the structure and format of a parsed backup manifest.
 * Returns row-level errors for individual data items.
 */
export function validateBackupManifest(manifest: unknown): ImportValidationResult {
  const errors: ImportRowError[] = []
  const warnings: string[] = []

  if (!manifest || typeof manifest !== 'object') {
    return {
      success: false,
      totalRows: 0,
      validRows: 0,
      errorRows: [{ rowIndex: 0, rowType: 'element', error: 'Invalid manifest: not a valid object.' }],
      warnings: [],
      truncated: false,
    }
  }

  const m = manifest as Record<string, unknown>

  // Check format identifier
  if (m.format !== BACKUP_FORMAT) {
    errors.push({
      rowIndex: 0,
      rowType: 'element',
      field: 'format',
      error: `Unrecognized backup format: "${String(m.format)}". Expected "${BACKUP_FORMAT}".`,
      rawValue: m.format,
    })
  }

  // Check version
  if (m.version !== 1) {
    errors.push({
      rowIndex: 0,
      rowType: 'element',
      field: 'version',
      error: `Unsupported backup version: ${String(m.version)}.`,
      rawValue: m.version,
    })
  }

  // Check data section exists
  if (!m.data || typeof m.data !== 'object') {
    errors.push({
      rowIndex: 0,
      rowType: 'element',
      field: 'data',
      error: 'Missing or invalid data section in backup manifest.',
    })
    return {
      success: false,
      totalRows: 0,
      validRows: 0,
      errorRows: errors,
      warnings,
      truncated: false,
    }
  }

  const data = m.data as Record<string, unknown>

  // Validate each data array
  let totalRows = 0
  let validRows = 0
  let stickyNoteCount = 0
  let commentCount = 0

  // Elements
  if (Array.isArray(data.elements)) {
    for (let i = 0; i < data.elements.length; i++) {
      totalRows++
      const el = data.elements[i] as Record<string, unknown>
      if (!el || typeof el !== 'object' || !el.elementId || !el.type) {
        errors.push({
          rowIndex: i,
          rowType: 'element',
          error: 'Invalid element: missing elementId or type.',
          rawValue: el,
        })
      } else {
        validRows++
        if (el.type === 'sticky-note') stickyNoteCount++
      }
    }
  }

  // Comments
  if (Array.isArray(data.comments)) {
    for (let i = 0; i < data.comments.length; i++) {
      totalRows++
      const c = data.comments[i] as Record<string, unknown>
      if (!c || typeof c !== 'object' || !c.commentId || !c.threadId) {
        errors.push({
          rowIndex: i,
          rowType: 'comment',
          error: 'Invalid comment: missing commentId or threadId.',
          rawValue: c,
        })
      } else {
        validRows++
        commentCount++
      }
    }
  }

  // Chat messages
  if (Array.isArray(data.chatMessages)) {
    for (let i = 0; i < data.chatMessages.length; i++) {
      totalRows++
      const msg = data.chatMessages[i] as Record<string, unknown>
      if (!msg || typeof msg !== 'object' || !msg.messageId) {
        errors.push({
          rowIndex: i,
          rowType: 'chat-message',
          error: 'Invalid chat message: missing messageId.',
          rawValue: msg,
        })
      } else {
        validRows++
      }
    }
  }

  // Members
  if (Array.isArray(data.members)) {
    for (let i = 0; i < data.members.length; i++) {
      totalRows++
      const member = data.members[i] as Record<string, unknown>
      if (!member || typeof member !== 'object' || !member.memberId) {
        errors.push({
          rowIndex: i,
          rowType: 'member',
          error: 'Invalid member: missing memberId.',
          rawValue: member,
        })
      } else {
        validRows++
      }
    }
  }

  // Check bulk import cap
  const bulkCapResult = validateBulkImportCap(stickyNoteCount, commentCount)
  const truncated = !bulkCapResult.valid

  if (truncated) {
    warnings.push(
      `Batch contains ${stickyNoteCount + commentCount} sticky notes + comments and exceeds the ${MAX_BULK_IMPORT_ITEMS}-item cap.`
    )
    errors.push({
      rowIndex: 0,
      rowType: 'element',
      field: 'bulkImportCount',
      error: bulkCapResult.errors[0]?.message ??
        `Batch exceeds the ${MAX_BULK_IMPORT_ITEMS}-item sticky note/comment cap.`,
      rawValue: stickyNoteCount + commentCount,
    })
  }

  return {
    success: errors.length === 0,
    totalRows,
    validRows,
    errorRows: errors,
    warnings,
    truncated,
  }
}

/**
 * Validate file size before deeper parsing.
 * Combines size check with format validation.
 */
export function validateImportFile(fileSizeBytes: number, parsedContent: unknown): ImportValidationResult {
  const sizeResult = validateBackupFileSize(fileSizeBytes)
  if (!sizeResult.valid) {
    return {
      success: false,
      totalRows: 0,
      validRows: 0,
      errorRows: [{
        rowIndex: 0,
        rowType: 'element',
        field: 'fileSize',
        error: sizeResult.errors[0].message,
      }],
      warnings: [],
      truncated: false,
    }
  }

  return validateBackupManifest(parsedContent)
}

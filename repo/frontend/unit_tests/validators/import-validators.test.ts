// REQ: R20 — Backup import: 200 MB file limit, 1K batch cap, row validation
import { describe, it, expect } from 'vitest'
import {
  validateBackupFileSize,
  validateBulkImportCap,
  validateBackupManifest,
  validateImportFile,
} from '@/validators/import-validators'
import { MAX_BACKUP_SIZE_BYTES, MAX_BULK_IMPORT_ITEMS, BACKUP_FORMAT } from '@/models/constants'

describe('validateBackupFileSize', () => {
  it('passes under 200 MB', () => {
    expect(validateBackupFileSize(100 * 1024 * 1024).valid).toBe(true)
  })

  it('passes at exactly 200 MB', () => {
    expect(validateBackupFileSize(MAX_BACKUP_SIZE_BYTES).valid).toBe(true)
  })

  it('fails at 200 MB + 1 byte', () => {
    const result = validateBackupFileSize(MAX_BACKUP_SIZE_BYTES + 1)
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('max_size')
  })
})

describe('validateBulkImportCap', () => {
  it('passes when combined count is under 1,000', () => {
    expect(validateBulkImportCap(400, 500).valid).toBe(true)
  })

  it('passes at exactly 1,000', () => {
    expect(validateBulkImportCap(500, 500).valid).toBe(true)
  })

  it('fails when combined count exceeds 1,000', () => {
    const result = validateBulkImportCap(600, 500)
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('cap_exceeded')
  })

  it('handles zero counts', () => {
    expect(validateBulkImportCap(0, 0).valid).toBe(true)
  })
})

describe('validateBackupManifest', () => {
  const validManifest = {
    version: 1,
    format: BACKUP_FORMAT,
    exportedAt: '2026-01-01T00:00:00.000Z',
    exportedBy: 'Test User',
    roomId: 'room-1',
    roomName: 'Test Room',
    data: {
      room: { roomId: 'room-1' },
      members: [{ memberId: 'member-1' }],
      elements: [{ elementId: 'el-1', type: 'sticky-note' }],
      comments: [{ commentId: 'c-1', threadId: 't-1' }],
      chatMessages: [{ messageId: 'msg-1' }],
    },
  }

  it('passes for a valid manifest', () => {
    const result = validateBackupManifest(validManifest)
    expect(result.success).toBe(true)
    expect(result.errorRows).toHaveLength(0)
  })

  it('fails for null input', () => {
    const result = validateBackupManifest(null)
    expect(result.success).toBe(false)
  })

  it('fails for wrong format', () => {
    const result = validateBackupManifest({ ...validManifest, format: 'wrong-format' })
    expect(result.success).toBe(false)
    expect(result.errorRows.some(e => e.field === 'format')).toBe(true)
  })

  it('fails for wrong version', () => {
    const result = validateBackupManifest({ ...validManifest, version: 99 })
    expect(result.success).toBe(false)
  })

  it('fails for missing data section', () => {
    const { data: _data, ...noData } = validManifest
    const result = validateBackupManifest(noData)
    expect(result.success).toBe(false)
  })

  it('reports row-level errors for invalid elements', () => {
    const manifest = {
      ...validManifest,
      data: {
        ...validManifest.data,
        elements: [{ elementId: 'valid', type: 'sticky-note' }, { badField: true }],
      },
    }
    const result = validateBackupManifest(manifest)
    expect(result.errorRows.some(e => e.rowType === 'element')).toBe(true)
  })

  it('reports row-level errors for invalid comments', () => {
    const manifest = {
      ...validManifest,
      data: {
        ...validManifest.data,
        comments: [{ missing: true }],
      },
    }
    const result = validateBackupManifest(manifest)
    expect(result.errorRows.some(e => e.rowType === 'comment')).toBe(true)
  })

  it('flags truncated when sticky notes + comments exceed 1,000', () => {
    const manyElements = Array.from({ length: 800 }, (_, i) => ({
      elementId: `el-${i}`,
      type: 'sticky-note',
    }))
    const manyComments = Array.from({ length: 300 }, (_, i) => ({
      commentId: `c-${i}`,
      threadId: `t-${i}`,
    }))
    const manifest = {
      ...validManifest,
      data: {
        ...validManifest.data,
        elements: manyElements,
        comments: manyComments,
      },
    }
    const result = validateBackupManifest(manifest)
    expect(result.truncated).toBe(true)
    expect(result.success).toBe(false)
    expect(result.errorRows.some(e => e.field === 'bulkImportCount')).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)
  })
})

describe('validateImportFile', () => {
  it('fails immediately if file size exceeds 200 MB', () => {
    const result = validateImportFile(MAX_BACKUP_SIZE_BYTES + 1, {})
    expect(result.success).toBe(false)
    expect(result.errorRows[0].field).toBe('fileSize')
  })

  it('proceeds to manifest validation if size is OK', () => {
    const result = validateImportFile(1000, null)
    expect(result.success).toBe(false) // null manifest fails
  })
})

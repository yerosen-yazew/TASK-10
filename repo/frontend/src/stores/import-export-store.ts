// REQ: R20 — Backup export/import coordination store
// Orchestrates export (size pre-check → serialize → Blob download) and
// import (file pick → size check → parse → row validate → persist).

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { MAX_BACKUP_SIZE_BYTES, MAX_BULK_IMPORT_ITEMS } from '@/models/constants'
import type { BackupManifest, BackupImageReference, ImportValidationResult } from '@/models/backup'
import {
  buildBackupManifest,
  serializeBackup,
  deserializeBackup,
  estimateBackupSize,
} from '@/serializers/backup-serializer'
import { validateImportFile } from '@/validators/import-validators'
import { roomRepository } from '@/services/room-repository'
import { memberRepository } from '@/services/member-repository'
import { elementRepository } from '@/services/element-repository'
import { commentThreadRepository } from '@/services/comment-thread-repository'
import { commentRepository } from '@/services/comment-repository'
import { chatMessageRepository } from '@/services/chat-message-repository'
import { pinnedMessageRepository } from '@/services/pinned-message-repository'
import { activityRepository } from '@/services/activity-repository'
import { snapshotRepository } from '@/services/snapshot-repository'
import { imageBlobRepository } from '@/services/image-blob-repository'
import { ElementType, type ImageRecord } from '@/models/element'
import { nowISO } from '@/utils/date-utils'
import { logger } from '@/utils/logger'

/** Encode a Blob as base64 (no data: prefix). */
async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const commaIdx = dataUrl.indexOf(',')
        resolve(commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl)
      }
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
      reader.readAsDataURL(blob)
    })
  }
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return typeof btoa === 'function' ? btoa(binary) : ''
}

/** Decode base64 data to a Blob of the given mime type. */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = typeof atob === 'function' ? atob(base64) : ''
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

async function readBlobText(blob: Blob): Promise<string> {
  const maybeText = (blob as { text?: () => Promise<string> }).text
  if (typeof maybeText === 'function') {
    return maybeText.call(blob)
  }

  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
      reader.readAsText(blob)
    })
  }

  throw new Error('Unable to read file text in this environment.')
}

export const useImportExportStore = defineStore('import-export', () => {
  const isExporting = ref(false)
  const isImporting = ref(false)
  const lastError = ref<string | null>(null)
  const lastImportResult = ref<ImportValidationResult | null>(null)
  const exportProgress = ref(0)
  const importProgress = ref(0)

  /**
   * Export a room to a downloadable backup JSON file.
   * Pre-checks estimated size; post-checks final serialized size.
   */
  async function exportRoom(roomId: string, exportedBy: string): Promise<void> {
    isExporting.value = true
    lastError.value = null
    exportProgress.value = 0

    try {
      const room = await roomRepository.getById(roomId)
      if (!room) {
        lastError.value = 'Room not found.'
        return
      }

      exportProgress.value = 10

      const [
        members,
        elements,
        commentThreads,
        comments,
        chatMessages,
        pinnedMessages,
        activityFeed,
        snapshots,
        imageRecords,
      ] = await Promise.all([
        memberRepository.listByRoom(roomId),
        elementRepository.listByRoom(roomId),
        commentThreadRepository.listByRoom(roomId),
        commentRepository.listByRoom(roomId),
        chatMessageRepository.listByRoom(roomId),
        pinnedMessageRepository.listByRoom(roomId),
        activityRepository.listByRoom(roomId),
        snapshotRepository.listByRoom(roomId),
        imageBlobRepository.listByRoom(roomId),
      ])

      exportProgress.value = 40

      const images: BackupImageReference[] = []
      for (const rec of imageRecords) {
        const base64Data = await blobToBase64(rec.blob)
        images.push({
          imageId: rec.imageId,
          elementId: rec.elementId,
          fileName: rec.fileName,
          mimeType: rec.mimeType,
          fileSizeBytes: rec.fileSizeBytes,
          base64Data,
        })
      }

      exportProgress.value = 50

      const input = {
        room,
        members,
        elements,
        images,
        commentThreads,
        comments,
        chatMessages,
        pinnedMessages,
        activityFeed,
        snapshots,
        exportedBy,
      }

      // Pre-check estimated size
      const estimatedSize = estimateBackupSize(input)
      if (estimatedSize > MAX_BACKUP_SIZE_BYTES) {
        lastError.value = `Estimated export size (${(estimatedSize / 1024 / 1024).toFixed(1)} MB) exceeds the 200 MB limit.`
        return
      }

      const manifest = buildBackupManifest(input)
      exportProgress.value = 75

      const json = serializeBackup(manifest)
      const finalSize = new TextEncoder().encode(json).length
      if (finalSize > MAX_BACKUP_SIZE_BYTES) {
        lastError.value = `Export file (${(finalSize / 1024 / 1024).toFixed(1)} MB) exceeds the 200 MB limit.`
        return
      }

      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `forgeroom-${room.name.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)

      exportProgress.value = 100
      logger.info('Backup exported', { roomId, sizeBytes: finalSize })
    } catch (err) {
      logger.error('Export failed', { roomId, err })
      lastError.value = 'Export failed due to an unexpected error.'
    } finally {
      isExporting.value = false
    }
  }

  /**
   * Import a room backup from a File object.
   * Validates size, parses manifest, and returns row-level validation results.
   * Actual persistence is performed after user confirmation (not here).
   */
  async function validateImport(file: File): Promise<ImportValidationResult | null> {
    isImporting.value = true
    lastError.value = null
    lastImportResult.value = null
    importProgress.value = 0

    try {
      if (file.size > MAX_BACKUP_SIZE_BYTES) {
        const result: ImportValidationResult = {
          success: false,
          totalRows: 0,
          validRows: 0,
          errorRows: [{
            rowIndex: 0,
            rowType: 'element',
            field: 'fileSize',
            error: `File exceeds the 200 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`,
          }],
          warnings: [],
          truncated: false,
        }
        lastImportResult.value = result
        return result
      }

      importProgress.value = 20

      const text = await readBlobText(file)
      importProgress.value = 50

      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        const result: ImportValidationResult = {
          success: false,
          totalRows: 0,
          validRows: 0,
          errorRows: [{ rowIndex: 0, rowType: 'element', error: 'File is not valid JSON.' }],
          warnings: [],
          truncated: false,
        }
        lastImportResult.value = result
        return result
      }

      importProgress.value = 70

      const result = validateImportFile(file.size, parsed)
      lastImportResult.value = result
      importProgress.value = 100

      logger.info('Import validation complete', {
        success: result.success,
        errorRows: result.errorRows.length,
      })
      return result
    } catch (err) {
      logger.error('Import validation failed', { err })
      lastError.value = 'Import validation failed due to an unexpected error.'
      return null
    } finally {
      isImporting.value = false
    }
  }

  /**
   * Persist a validated backup manifest to IndexedDB.
   * Only call after `validateImport` returned success.
   */
  async function persistImport(manifest: BackupManifest): Promise<void> {
    isImporting.value = true
    lastError.value = null

    try {
      const { data } = manifest
      const stickyNoteCount = data.elements.filter(
        (el) => el.type === ElementType.StickyNote
      ).length
      const cappedCount = stickyNoteCount + data.comments.length
      if (cappedCount > MAX_BULK_IMPORT_ITEMS) {
        throw new Error(
          `Import exceeds sticky-note/comment cap: ${cappedCount} > ${MAX_BULK_IMPORT_ITEMS}.`
        )
      }

      await roomRepository.put(data.room)
      for (const m of data.members) await memberRepository.put(m)
      for (const e of data.elements) await elementRepository.put(e)
      for (const ct of data.commentThreads) await commentThreadRepository.put(ct)
      for (const c of data.comments) await commentRepository.put(c)
      for (const msg of data.chatMessages) await chatMessageRepository.put(msg)
      for (const p of data.pinnedMessages) await pinnedMessageRepository.put(p)
      for (const ev of data.activityFeed) await activityRepository.put(ev)
      for (const s of data.snapshots) await snapshotRepository.put(s)
      for (const img of data.images) {
        const blob = base64ToBlob(img.base64Data, img.mimeType)
        const record: ImageRecord = {
          imageId: img.imageId,
          roomId: manifest.roomId,
          elementId: img.elementId,
          blob,
          fileName: img.fileName,
          mimeType: img.mimeType,
          fileSizeBytes: img.fileSizeBytes,
          createdAt: nowISO(),
        }
        await imageBlobRepository.put(record)
      }

      logger.info('Import persisted', {
        roomId: manifest.roomId,
        imageCount: data.images.length,
      })
    } catch (err) {
      logger.error('Import persist failed', { err })
      lastError.value = 'Failed to save imported data.'
      throw err
    } finally {
      isImporting.value = false
    }
  }

  /** Parse and return a BackupManifest from a File without persisting. */
  async function parseManifest(file: File): Promise<BackupManifest | null> {
    try {
      const text = await readBlobText(file)
      return deserializeBackup(text)
    } catch {
      return null
    }
  }

  function clearError(): void {
    lastError.value = null
  }

  return {
    isExporting,
    isImporting,
    lastError,
    lastImportResult,
    exportProgress,
    importProgress,
    exportRoom,
    validateImport,
    persistImport,
    parseManifest,
    clearError,
  }
})

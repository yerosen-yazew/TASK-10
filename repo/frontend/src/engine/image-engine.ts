// REQ: R6 — Image drop-in with 5 MB per image + 50 images per room enforcement

import type { ValidationResult } from '@/models/validation'
import { invalidResult, mergeResults, validResult } from '@/models/validation'
import { validateImageSize, validateImageCount } from '@/validators/element-validators'
import { imageBlobRepository } from '@/services/image-blob-repository'
import { createImageElement } from './element-engine'
import type { ActivityActor } from './activity-engine'
import type { Position, Dimensions, ImageElement, ImageRecord } from '@/models/element'
import { generateId } from '@/utils/id-generator'
import { nowISO } from '@/utils/date-utils'

export interface IngestImageInput {
  roomId: string
  blob: Blob
  fileName: string
  mimeType: string
  position: Position
  dimensions: Dimensions
  alt?: string
  actor: ActivityActor
}

export interface IngestImageResult {
  validation: ValidationResult
  element?: ImageElement
  imageRecord?: ImageRecord
}

/**
 * Ingest an image: validates size + per-room count, stores the blob in the
 * images store, then creates the corresponding whiteboard ImageElement.
 */
export async function ingestImageFile(input: IngestImageInput): Promise<IngestImageResult> {
  const size = input.blob.size
  const sizeCheck = validateImageSize(size)
  const countCheck = validateImageCount(await imageBlobRepository.countByRoom(input.roomId))
  const validation = mergeResults(sizeCheck, countCheck)
  if (!validation.valid) return { validation }

  const imageId = generateId()
  const now = nowISO()

  // Create the element first so it has a stable elementId to link back.
  const elementResult = await createImageElement({
    roomId: input.roomId,
    imageId,
    position: input.position,
    dimensions: input.dimensions,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSizeBytes: size,
    alt: input.alt ?? input.fileName,
    actor: input.actor,
  })
  if (!elementResult.validation.valid || !elementResult.element) {
    return { validation: elementResult.validation }
  }

  const imageRecord: ImageRecord = {
    imageId,
    roomId: input.roomId,
    elementId: elementResult.element.elementId,
    blob: input.blob,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSizeBytes: size,
    createdAt: now,
  }
  await imageBlobRepository.put(imageRecord)

  return { validation: validResult(), element: elementResult.element, imageRecord }
}

/** Retrieve an image blob record by id. */
export async function getImageBlob(imageId: string): Promise<ImageRecord | undefined> {
  return imageBlobRepository.getById(imageId)
}

/** Delete an image blob record. */
export async function deleteImageBlob(imageId: string): Promise<ValidationResult> {
  const existing = await imageBlobRepository.getById(imageId)
  if (!existing) {
    return invalidResult('imageId', 'Image not found.', 'not_found', imageId)
  }
  await imageBlobRepository.delete(imageId)
  return validResult()
}

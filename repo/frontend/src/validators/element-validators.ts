// REQ: R6 — 2,000 element cap, 5 MB per image, 50 images per room

import {
  MAX_ELEMENTS_PER_ROOM,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGES_PER_ROOM,
} from '@/models/constants'
import type { ValidationResult } from '@/models/validation'
import { validResult, invalidResult } from '@/models/validation'

/**
 * Validate that the room has not exceeded the maximum element count.
 * @param currentElementCount Number of elements currently in the room.
 */
export function validateElementCount(currentElementCount: number): ValidationResult {
  if (currentElementCount >= MAX_ELEMENTS_PER_ROOM) {
    return invalidResult(
      'elementCount',
      `Room has reached the maximum of ${MAX_ELEMENTS_PER_ROOM} elements.`,
      'max_count',
      currentElementCount
    )
  }
  return validResult()
}

/**
 * Validate that an image file does not exceed the maximum size.
 * @param fileSizeBytes Size of the image file in bytes.
 */
export function validateImageSize(fileSizeBytes: number): ValidationResult {
  if (fileSizeBytes > MAX_IMAGE_SIZE_BYTES) {
    return invalidResult(
      'imageSize',
      `Image exceeds the maximum size of 5 MB (${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB).`,
      'max_size',
      fileSizeBytes
    )
  }
  return validResult()
}

/**
 * Validate that the room has not exceeded the maximum image count.
 * @param currentImageCount Number of images currently in the room.
 */
export function validateImageCount(currentImageCount: number): ValidationResult {
  if (currentImageCount >= MAX_IMAGES_PER_ROOM) {
    return invalidResult(
      'imageCount',
      `Room has reached the maximum of ${MAX_IMAGES_PER_ROOM} images.`,
      'max_count',
      currentImageCount
    )
  }
  return validResult()
}

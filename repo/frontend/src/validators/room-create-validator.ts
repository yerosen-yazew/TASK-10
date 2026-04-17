// REQ: R1 — Room creation payload validation (name, description, settings)

import type { ValidationResult } from '@/models/validation'
import { validResult, invalidResult, mergeResults } from '@/models/validation'

/** Payload for room creation. */
export interface RoomCreatePayload {
  name: string
  description: string
  settings: {
    requireApproval: boolean
    enableSecondReviewer: boolean
  }
}

/** Maximum allowed length for a room name. */
const MAX_ROOM_NAME_LENGTH = 100

/** Maximum allowed length for a room description. */
const MAX_ROOM_DESCRIPTION_LENGTH = 500

/**
 * Validate the room name: required, 1–100 characters.
 */
export function validateRoomName(name: string): ValidationResult {
  const trimmed = name.trim()
  if (!trimmed) {
    return invalidResult('name', 'Room name is required.', 'required')
  }
  if (trimmed.length > MAX_ROOM_NAME_LENGTH) {
    return invalidResult(
      'name',
      `Room name must be ${MAX_ROOM_NAME_LENGTH} characters or fewer.`,
      'max_length',
      trimmed.length
    )
  }
  return validResult()
}

/**
 * Validate the room description: optional, max 500 characters.
 */
export function validateRoomDescription(description: string): ValidationResult {
  if (description.length > MAX_ROOM_DESCRIPTION_LENGTH) {
    return invalidResult(
      'description',
      `Room description must be ${MAX_ROOM_DESCRIPTION_LENGTH} characters or fewer.`,
      'max_length',
      description.length
    )
  }
  return validResult()
}

/**
 * Validate a complete room creation payload.
 */
export function validateRoomCreatePayload(payload: RoomCreatePayload): ValidationResult {
  return mergeResults(
    validateRoomName(payload.name),
    validateRoomDescription(payload.description)
  )
}

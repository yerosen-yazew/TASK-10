// REQ: R5 — Sticky notes, arrows/connectors, freehand pen, image drop-in
// REQ: R6 — 2,000 element cap
// REQ: R10 — Emit create/edit/delete activity for elements

import {
  ElementType,
  type WhiteboardElement,
  type StickyNote,
  type Arrow,
  type PenStroke,
  type ImageElement,
  type Position,
  type Dimensions,
  type StrokePoint,
} from '@/models/element'
import type { ValidationResult } from '@/models/validation'
import { validResult, invalidResult } from '@/models/validation'
import { validateElementCount } from '@/validators/element-validators'
import { elementRepository } from '@/services/element-repository'
import { generateId } from '@/utils/id-generator'
import { nowISO } from '@/utils/date-utils'
import { emitActivity, type ActivityActor } from './activity-engine'
import { ActivityEventType } from '@/models/activity'
import type { ElementOpPayload } from '@/models/collaboration'

/** Result of an element mutation. */
export interface ElementResult<T extends WhiteboardElement = WhiteboardElement> {
  validation: ValidationResult
  element?: T
}

async function nextZIndex(roomId: string): Promise<number> {
  return (await elementRepository.maxZIndexByRoom(roomId)) + 1
}

async function enforceElementCap(roomId: string): Promise<ValidationResult> {
  const count = await elementRepository.countByRoom(roomId)
  return validateElementCount(count)
}

// ── Sticky notes ────────────────────────────────────────────────────────────

export interface CreateStickyInput {
  roomId: string
  position: Position
  dimensions: Dimensions
  text: string
  backgroundColor: string
  textColor: string
  fontSize: number
  actor: ActivityActor
}

export async function createSticky(input: CreateStickyInput): Promise<ElementResult<StickyNote>> {
  const cap = await enforceElementCap(input.roomId)
  if (!cap.valid) return { validation: cap }
  const now = nowISO()
  const sticky: StickyNote = {
    elementId: generateId(),
    roomId: input.roomId,
    type: ElementType.StickyNote,
    position: input.position,
    zIndex: await nextZIndex(input.roomId),
    createdBy: input.actor.memberId,
    createdAt: now,
    updatedAt: now,
    dimensions: input.dimensions,
    text: input.text,
    backgroundColor: input.backgroundColor,
    textColor: input.textColor,
    fontSize: input.fontSize,
  }
  await elementRepository.put(sticky)
  await emitActivity(
    input.roomId,
    ActivityEventType.ElementCreated,
    input.actor,
    `Added a sticky note`,
    { targetId: sticky.elementId, targetType: 'element' },
    { elementType: ElementType.StickyNote }
  )
  return { validation: validResult(), element: sticky }
}

// ── Arrows ──────────────────────────────────────────────────────────────────

export interface CreateArrowInput {
  roomId: string
  startPoint: Position
  endPoint: Position
  startElementId?: string
  endElementId?: string
  strokeColor: string
  strokeWidth: number
  arrowHeadStyle: 'none' | 'triangle' | 'diamond'
  actor: ActivityActor
}

export async function createArrow(input: CreateArrowInput): Promise<ElementResult<Arrow>> {
  const cap = await enforceElementCap(input.roomId)
  if (!cap.valid) return { validation: cap }
  const now = nowISO()
  const arrow: Arrow = {
    elementId: generateId(),
    roomId: input.roomId,
    type: ElementType.Arrow,
    position: input.startPoint,
    zIndex: await nextZIndex(input.roomId),
    createdBy: input.actor.memberId,
    createdAt: now,
    updatedAt: now,
    startPoint: input.startPoint,
    endPoint: input.endPoint,
    startElementId: input.startElementId,
    endElementId: input.endElementId,
    strokeColor: input.strokeColor,
    strokeWidth: input.strokeWidth,
    arrowHeadStyle: input.arrowHeadStyle,
  }
  await elementRepository.put(arrow)
  await emitActivity(
    input.roomId,
    ActivityEventType.ElementCreated,
    input.actor,
    `Added an arrow`,
    { targetId: arrow.elementId, targetType: 'element' },
    { elementType: ElementType.Arrow }
  )
  return { validation: validResult(), element: arrow }
}

// ── Pen strokes ─────────────────────────────────────────────────────────────

export interface CreatePenStrokeInput {
  roomId: string
  position: Position
  points: StrokePoint[]
  strokeColor: string
  strokeWidth: number
  actor: ActivityActor
}

export async function createPenStroke(
  input: CreatePenStrokeInput
): Promise<ElementResult<PenStroke>> {
  const cap = await enforceElementCap(input.roomId)
  if (!cap.valid) return { validation: cap }
  const now = nowISO()
  const stroke: PenStroke = {
    elementId: generateId(),
    roomId: input.roomId,
    type: ElementType.PenStroke,
    position: input.position,
    zIndex: await nextZIndex(input.roomId),
    createdBy: input.actor.memberId,
    createdAt: now,
    updatedAt: now,
    points: input.points,
    strokeColor: input.strokeColor,
    strokeWidth: input.strokeWidth,
  }
  await elementRepository.put(stroke)
  await emitActivity(
    input.roomId,
    ActivityEventType.ElementCreated,
    input.actor,
    `Drew a pen stroke`,
    { targetId: stroke.elementId, targetType: 'element' },
    { elementType: ElementType.PenStroke }
  )
  return { validation: validResult(), element: stroke }
}

// ── Image elements ──────────────────────────────────────────────────────────

export interface CreateImageElementInput {
  roomId: string
  imageId: string
  position: Position
  dimensions: Dimensions
  fileName: string
  mimeType: string
  fileSizeBytes: number
  alt: string
  actor: ActivityActor
}

export async function createImageElement(
  input: CreateImageElementInput
): Promise<ElementResult<ImageElement>> {
  const cap = await enforceElementCap(input.roomId)
  if (!cap.valid) return { validation: cap }
  const now = nowISO()
  const image: ImageElement = {
    elementId: generateId(),
    roomId: input.roomId,
    type: ElementType.Image,
    position: input.position,
    zIndex: await nextZIndex(input.roomId),
    createdBy: input.actor.memberId,
    createdAt: now,
    updatedAt: now,
    dimensions: input.dimensions,
    imageId: input.imageId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    alt: input.alt,
  }
  await elementRepository.put(image)
  await emitActivity(
    input.roomId,
    ActivityEventType.ElementCreated,
    input.actor,
    `Added image "${input.fileName}"`,
    { targetId: image.elementId, targetType: 'element' },
    { elementType: ElementType.Image, imageId: input.imageId }
  )
  return { validation: validResult(), element: image }
}

// ── Shared update/delete/list ───────────────────────────────────────────────

/** Update an existing element with a partial patch (type-preserving). */
export async function updateElement<T extends WhiteboardElement>(
  elementId: string,
  patch: Partial<Omit<T, 'elementId' | 'roomId' | 'type' | 'createdBy' | 'createdAt'>>,
  actor: ActivityActor
): Promise<ElementResult> {
  const existing = (await elementRepository.getById(elementId)) as T | undefined
  if (!existing) {
    return { validation: invalidResult('elementId', 'Element not found.', 'not_found', elementId) }
  }
  const updated = {
    ...existing,
    ...patch,
    elementId: existing.elementId,
    roomId: existing.roomId,
    type: existing.type,
    createdBy: existing.createdBy,
    createdAt: existing.createdAt,
    updatedAt: nowISO(),
  } as WhiteboardElement
  await elementRepository.put(updated)
  await emitActivity(
    existing.roomId,
    ActivityEventType.ElementUpdated,
    actor,
    `Edited element`,
    { targetId: elementId, targetType: 'element' },
    { elementType: existing.type }
  )
  return { validation: validResult(), element: updated }
}

/** Delete an element and emit activity. */
export async function deleteElement(
  elementId: string,
  actor: ActivityActor
): Promise<ElementResult> {
  const existing = await elementRepository.getById(elementId)
  if (!existing) {
    return { validation: invalidResult('elementId', 'Element not found.', 'not_found', elementId) }
  }
  await elementRepository.delete(elementId)
  await emitActivity(
    existing.roomId,
    ActivityEventType.ElementDeleted,
    actor,
    `Deleted element`,
    { targetId: elementId, targetType: 'element' },
    { elementType: existing.type }
  )
  return { validation: validResult(), element: existing }
}

/** Move an element to the front by assigning it the next zIndex. */
export async function bringToFront(
  elementId: string,
  actor: ActivityActor
): Promise<ElementResult> {
  const existing = await elementRepository.getById(elementId)
  if (!existing) {
    return { validation: invalidResult('elementId', 'Element not found.', 'not_found', elementId) }
  }
  const newZ = (await elementRepository.maxZIndexByRoom(existing.roomId)) + 1
  return updateElement(elementId, { zIndex: newZ }, actor)
}

/** List all elements in a room. */
export async function listElements(roomId: string): Promise<WhiteboardElement[]> {
  return elementRepository.listByRoom(roomId)
}

/**
 * Apply an inbound WebRTC element mutation payload to local IndexedDB.
 * This path intentionally skips local activity generation to avoid duplicate
 * feed entries when the mutation originated on a different peer.
 */
export async function applyElementMutation(
  roomId: string,
  payload: ElementOpPayload
): Promise<ValidationResult> {
  if (!payload.elementId) {
    return invalidResult('elementId', 'Missing element id in collaboration payload.', 'required')
  }

  if (payload.operation === 'delete') {
    await elementRepository.delete(payload.elementId)
    return validResult()
  }

  if (!payload.element) {
    return invalidResult(
      'element',
      `Missing element snapshot for ${payload.operation} operation.`,
      'required'
    )
  }

  if (payload.element.roomId !== roomId) {
    return invalidResult(
      'roomId',
      'Element payload room mismatch.',
      'invalid',
      { expected: roomId, actual: payload.element.roomId }
    )
  }

  if (payload.element.elementId !== payload.elementId) {
    return invalidResult(
      'elementId',
      'Element payload id mismatch.',
      'invalid',
      { expected: payload.elementId, actual: payload.element.elementId }
    )
  }

  await elementRepository.put(payload.element)
  return validResult()
}

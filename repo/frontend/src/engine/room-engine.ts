// REQ: R1 — Host creates Room
// REQ: R2 — Room link/pairing code
// REQ: R11 — Roles as UI personas only

import type { Room, RoomSettings, MemberRecord } from '@/models/room'
import { RoomRole, MembershipState } from '@/models/room'
import type { ValidationResult } from '@/models/validation'
import { validateRoomCreatePayload } from '@/validators/room-create-validator'
import { roomRepository } from '@/services/room-repository'
import { memberRepository } from '@/services/member-repository'
import { generateId, generatePairingCode } from '@/utils/id-generator'
import { nowISO } from '@/utils/date-utils'
import { emitActivity, type ActivityActor } from './activity-engine'
import { ActivityEventType } from '@/models/activity'

/** Payload for creating a new room. */
export interface CreateRoomInput {
  name: string
  description?: string
  hostProfileId: string
  hostDisplayName: string
  hostAvatarColor: string
  settings?: Partial<RoomSettings>
}

/** Result of a room creation attempt. */
export interface CreateRoomResult {
  validation: ValidationResult
  room?: Room
  hostMember?: MemberRecord
}

const DEFAULT_SETTINGS: RoomSettings = {
  requireApproval: true,
  enableSecondReviewer: false,
}

/**
 * Create a new room and register the Host as an Active member.
 * Validates name/description via the existing room-create validators.
 */
export async function createRoom(input: CreateRoomInput): Promise<CreateRoomResult> {
  const validation = validateRoomCreatePayload({
    name: input.name,
    description: input.description ?? '',
  })
  if (!validation.valid) return { validation }

  const createdAt = nowISO()
  const room: Room = {
    roomId: generateId(),
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    hostProfileId: input.hostProfileId,
    pairingCode: generatePairingCode(),
    settings: { ...DEFAULT_SETTINGS, ...(input.settings ?? {}) },
    createdAt,
    updatedAt: createdAt,
  }
  await roomRepository.put(room)

  const hostMember: MemberRecord = {
    roomId: room.roomId,
    memberId: input.hostProfileId,
    displayName: input.hostDisplayName,
    avatarColor: input.hostAvatarColor,
    role: RoomRole.Host,
    state: MembershipState.Active,
    joinedAt: createdAt,
    stateChangedAt: createdAt,
    approvals: [],
  }
  await memberRepository.put(hostMember)

  const actor: ActivityActor = {
    memberId: input.hostProfileId,
    displayName: input.hostDisplayName,
  }
  await emitActivity(
    room.roomId,
    ActivityEventType.RoomCreated,
    actor,
    `Created room "${room.name}"`,
    { targetId: room.roomId, targetType: 'member' }
  )

  return { validation, room, hostMember }
}

/** Fetch a room by ID. */
export async function getRoom(roomId: string): Promise<Room | undefined> {
  return roomRepository.getById(roomId)
}

/** Update a room's settings and bump its updatedAt. */
export async function updateRoomSettings(
  roomId: string,
  patch: Partial<RoomSettings>
): Promise<Room | undefined> {
  const room = await roomRepository.getById(roomId)
  if (!room) return undefined
  const updated: Room = {
    ...room,
    settings: { ...room.settings, ...patch },
    updatedAt: nowISO(),
  }
  await roomRepository.put(updated)
  return updated
}

/** Remove a room record (for local cleanup — does not cascade). */
export async function archiveRoom(roomId: string): Promise<void> {
  await roomRepository.delete(roomId)
}

/** List all known rooms. */
export async function listRooms(): Promise<Room[]> {
  return roomRepository.listAll()
}

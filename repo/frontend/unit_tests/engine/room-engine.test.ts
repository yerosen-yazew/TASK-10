// REQ: R1, R2 — Room creation, pairing code, host member, activity event

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createRoom,
  getRoom,
  updateRoomSettings,
  archiveRoom,
  listRooms,
} from '@/engine/room-engine'
import { DB_NAME } from '@/models/constants'
import { MembershipState, RoomRole } from '@/models/room'
import { memberRepository } from '@/services/member-repository'
import { activityRepository } from '@/services/activity-repository'
import { ActivityEventType } from '@/models/activity'

async function resetDb() {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
    req.onblocked = () => resolve()
  })
}

function baseInput(overrides: any = {}) {
  return {
    name: 'Design Crit',
    description: 'Wed sync',
    hostProfileId: 'host-1',
    hostDisplayName: 'Alex',
    hostAvatarColor: '#123456',
    ...overrides,
  }
}

describe('room-engine', () => {
  beforeEach(async () => {
    await resetDb()
  })

  it('createRoom persists the room with a pairing code and default settings', async () => {
    const result = await createRoom(baseInput())
    expect(result.validation.valid).toBe(true)
    expect(result.room).toBeDefined()
    expect(result.room!.pairingCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(result.room!.settings.requireApproval).toBe(true)
    expect(result.room!.settings.enableSecondReviewer).toBe(false)
  })

  it('createRoom registers the Host as an Active member', async () => {
    const result = await createRoom(baseInput())
    const hostMember = await memberRepository.find(
      result.room!.roomId,
      'host-1',
    )
    expect(hostMember?.role).toBe(RoomRole.Host)
    expect(hostMember?.state).toBe(MembershipState.Active)
  })

  it('createRoom emits a RoomCreated activity event', async () => {
    const result = await createRoom(baseInput())
    const events = await activityRepository.listByRoom(result.room!.roomId)
    expect(events.some((e) => e.type === ActivityEventType.RoomCreated)).toBe(true)
  })

  it('createRoom rejects an empty name via validation', async () => {
    const result = await createRoom(baseInput({ name: '' }))
    expect(result.validation.valid).toBe(false)
    expect(result.room).toBeUndefined()
  })

  it('createRoom trims whitespace in name and description', async () => {
    const result = await createRoom(
      baseInput({ name: '  Trimmed  ', description: '  hi  ' }),
    )
    expect(result.room!.name).toBe('Trimmed')
    expect(result.room!.description).toBe('hi')
  })

  it('getRoom returns the stored room', async () => {
    const created = await createRoom(baseInput())
    const fetched = await getRoom(created.room!.roomId)
    expect(fetched?.roomId).toBe(created.room!.roomId)
  })

  it('getRoom returns undefined for an unknown id', async () => {
    expect(await getRoom('nope')).toBeUndefined()
  })

  it('updateRoomSettings persists updates and bumps updatedAt', async () => {
    const created = await createRoom(baseInput())
    const before = created.room!.updatedAt
    await new Promise((r) => setTimeout(r, 5))
    const updated = await updateRoomSettings(created.room!.roomId, {
      enableSecondReviewer: true,
    })
    expect(updated?.settings.enableSecondReviewer).toBe(true)
    expect(updated!.updatedAt >= before).toBe(true)
  })

  it('updateRoomSettings returns undefined for unknown rooms', async () => {
    expect(await updateRoomSettings('ghost', {})).toBeUndefined()
  })

  it('listRooms returns every created room', async () => {
    await createRoom(baseInput({ name: 'A' }))
    await createRoom(baseInput({ name: 'B' }))
    const rooms = await listRooms()
    expect(rooms.length).toBeGreaterThanOrEqual(2)
  })

  it('archiveRoom deletes the room record', async () => {
    const created = await createRoom(baseInput())
    await archiveRoom(created.room!.roomId)
    expect(await getRoom(created.room!.roomId)).toBeUndefined()
  })
})

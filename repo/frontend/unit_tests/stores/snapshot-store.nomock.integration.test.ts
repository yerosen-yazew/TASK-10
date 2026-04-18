import { beforeEach, describe, expect, it } from 'vitest'
import { useSnapshotStore } from '@/stores/snapshot-store'
import { useUiStore } from '@/stores/ui-store'
import { setupNoMockTestEnv, seedActiveHostRoom } from '../integration/no-mock-test-harness'
import { snapshotRepository } from '@/services/snapshot-repository'
import { createSticky } from '@/engine/element-engine'
import { RoomRole } from '@/models/room'

function actor(memberId: string, displayName: string) {
  return { memberId, displayName, role: RoomRole.Host }
}

describe('snapshot-store no-mock integration', () => {
  beforeEach(async () => {
    await setupNoMockTestEnv()
  })

  it('refresh loads empty snapshot list for new room', async () => {
    const { room } = await seedActiveHostRoom()
    const store = useSnapshotStore()

    await store.refresh(room.roomId)

    expect(store.snapshots.length).toBe(0)
    expect(store.lastError).toBeNull()
  })

  it('captureManual creates and stores a new snapshot', async () => {
    const { room } = await seedActiveHostRoom()
    const store = useSnapshotStore()

    const snapshot = await store.captureManual(room.roomId)

    expect(snapshot).not.toBeNull()
    expect(snapshot?.roomId).toBe(room.roomId)
    expect(store.snapshots.length).toBe(1)
  })

  it('captureManual persists snapshot row in repository', async () => {
    const { room } = await seedActiveHostRoom()
    const store = useSnapshotStore()

    const snapshot = await store.captureManual(room.roomId)
    const persisted = await snapshotRepository.getById(snapshot!.snapshotId)

    expect(persisted?.snapshotId).toBe(snapshot!.snapshotId)
  })

  it('captureManual sequence numbers increase across captures', async () => {
    const { room } = await seedActiveHostRoom()
    const store = useSnapshotStore()

    const a = await store.captureManual(room.roomId)
    const b = await store.captureManual(room.roomId)

    expect((b?.sequenceNumber ?? 0)).toBeGreaterThan(a?.sequenceNumber ?? 0)
  })

  it('captures include room element state at creation time', async () => {
    const { room, host } = await seedActiveHostRoom()

    await createSticky({
      roomId: room.roomId,
      position: { x: 25, y: 35 },
      dimensions: { width: 180, height: 120 },
      text: 'snapshot element',
      backgroundColor: '#fef9c3',
      textColor: '#1e293b',
      fontSize: 14,
      actor: actor(host.profileId, host.displayName),
    })

    const store = useSnapshotStore()
    const snap = await store.captureManual(room.roomId)

    expect(snap?.data.elements.length).toBeGreaterThan(0)
  })

  it('rollback returns null when confirmation is rejected', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useSnapshotStore()
    const ui = useUiStore()

    const source = await store.captureManual(room.roomId)

    const pending = store.rollback(room.roomId, source!.snapshotId, actor(host.profileId, host.displayName))
    await Promise.resolve()
    ui.resolveConfirm(false)

    const result = await pending
    expect(result).toBeNull()
    expect(store.lastRollback).toBeNull()
  })

  it('rollback creates metadata and sets lastRollback on confirmed action', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useSnapshotStore()
    const ui = useUiStore()

    const source = await store.captureManual(room.roomId)

    await createSticky({
      roomId: room.roomId,
      position: { x: 60, y: 60 },
      dimensions: { width: 180, height: 120 },
      text: 'post-source element',
      backgroundColor: '#fef9c3',
      textColor: '#1e293b',
      fontSize: 14,
      actor: actor(host.profileId, host.displayName),
    })
    await store.captureManual(room.roomId)

    const pending = store.rollback(room.roomId, source!.snapshotId, actor(host.profileId, host.displayName))
    await Promise.resolve()
    ui.resolveConfirm(true)

    const result = await pending
    expect(result).not.toBeNull()
    expect(store.lastRollback?.sourceSnapshotId).toBe(source!.snapshotId)
    expect(store.lastRollback?.resultingSnapshotId).toBeTruthy()
  })

  it('rollback leaves source snapshot in repository history', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useSnapshotStore()
    const ui = useUiStore()

    const source = await store.captureManual(room.roomId)
    await store.captureManual(room.roomId)

    const pending = store.rollback(room.roomId, source!.snapshotId, actor(host.profileId, host.displayName))
    await Promise.resolve()
    ui.resolveConfirm(true)
    await pending

    const sourceStillThere = await snapshotRepository.getById(source!.snapshotId)
    expect(sourceStillThere?.snapshotId).toBe(source!.snapshotId)
  })

  it('rollback creates new resulting snapshot with higher sequence number', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useSnapshotStore()
    const ui = useUiStore()

    const source = await store.captureManual(room.roomId)
    const later = await store.captureManual(room.roomId)

    const pending = store.rollback(room.roomId, source!.snapshotId, actor(host.profileId, host.displayName))
    await Promise.resolve()
    ui.resolveConfirm(true)
    const metadata = await pending

    const resulting = await snapshotRepository.getById(metadata!.resultingSnapshotId)
    expect((resulting?.sequenceNumber ?? 0)).toBeGreaterThan(later!.sequenceNumber)
  })

  it('refresh after rollback includes resulting snapshot id', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useSnapshotStore()
    const ui = useUiStore()

    const source = await store.captureManual(room.roomId)
    const pending = store.rollback(room.roomId, source!.snapshotId, actor(host.profileId, host.displayName))
    await Promise.resolve()
    ui.resolveConfirm(true)
    const metadata = await pending

    await store.refresh(room.roomId)

    expect(store.snapshots.some((s) => s.snapshotId === metadata!.resultingSnapshotId)).toBe(true)
  })

  it('rollback on unknown snapshot sets error and returns null', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useSnapshotStore()
    const ui = useUiStore()

    const pending = store.rollback(room.roomId, 'missing-snapshot', actor(host.profileId, host.displayName))
    await Promise.resolve()
    ui.resolveConfirm(true)

    const result = await pending
    expect(result).toBeNull()
    expect(store.lastError).toBe('Rollback failed. Please try again.')
  })

  it('always clears isRollingBack after rollback attempt', async () => {
    const { room, host } = await seedActiveHostRoom()
    const store = useSnapshotStore()
    const ui = useUiStore()

    const snap = await store.captureManual(room.roomId)
    const pending = store.rollback(room.roomId, snap!.snapshotId, actor(host.profileId, host.displayName))
    await Promise.resolve()
    ui.resolveConfirm(true)
    await pending

    expect(store.isRollingBack).toBe(false)
  })
})

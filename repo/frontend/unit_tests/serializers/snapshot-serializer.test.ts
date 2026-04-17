// REQ: R17 — Snapshot create/serialize/deserialize roundtrip

import { describe, it, expect } from 'vitest'
import {
  createSnapshot,
  serializeSnapshot,
  deserializeSnapshot,
  type SnapshotInput,
} from '@/serializers/snapshot-serializer'

function buildInput(overrides: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    roomId: 'room-1',
    sequenceNumber: 1,
    elements: [],
    chatMessages: [],
    pinnedMessages: [],
    commentThreads: [],
    comments: [],
    members: [],
    activityEvents: [],
    ...overrides,
  }
}

describe('snapshot-serializer', () => {
  describe('createSnapshot', () => {
    it('populates snapshotId, createdAt, and sizeBytes', () => {
      const snap = createSnapshot(buildInput())
      expect(typeof snap.snapshotId).toBe('string')
      expect(snap.snapshotId.length).toBeGreaterThan(0)
      expect(typeof snap.createdAt).toBe('string')
      expect(typeof snap.sizeBytes).toBe('number')
      expect(snap.sizeBytes).toBeGreaterThan(0)
    })

    it('preserves roomId and sequenceNumber', () => {
      const snap = createSnapshot(buildInput({ roomId: 'r-2', sequenceNumber: 7 }))
      expect(snap.roomId).toBe('r-2')
      expect(snap.sequenceNumber).toBe(7)
    })

    it('captures nested collections under data', () => {
      const elements = [
        { elementId: 'e1', roomId: 'room-1', type: 'sticky' } as any,
      ]
      const snap = createSnapshot(buildInput({ elements }))
      expect(snap.data.elements).toEqual(elements)
    })
  })

  describe('serialize / deserialize roundtrip', () => {
    it('preserves all fields across JSON.stringify -> JSON.parse', () => {
      const snap = createSnapshot(
        buildInput({
          sequenceNumber: 3,
          chatMessages: [
            { messageId: 'c1', roomId: 'room-1', body: 'hi' } as any,
          ],
        }),
      )
      const json = serializeSnapshot(snap)
      const parsed = deserializeSnapshot(json)
      expect(parsed).not.toBeNull()
      expect(parsed!.snapshotId).toBe(snap.snapshotId)
      expect(parsed!.sequenceNumber).toBe(3)
      expect(parsed!.data.chatMessages[0]).toMatchObject({
        messageId: 'c1',
        body: 'hi',
      })
    })
  })

  describe('deserializeSnapshot', () => {
    it('returns null for invalid JSON', () => {
      expect(deserializeSnapshot('not-json')).toBeNull()
    })

    it('returns null when required fields are missing', () => {
      expect(deserializeSnapshot(JSON.stringify({ foo: 'bar' }))).toBeNull()
    })

    it('returns null for non-object JSON (e.g. number)', () => {
      expect(deserializeSnapshot('42')).toBeNull()
    })

    it('returns null when snapshotId is present but data is missing', () => {
      expect(
        deserializeSnapshot(
          JSON.stringify({ snapshotId: 's1', roomId: 'r1' }),
        ),
      ).toBeNull()
    })
  })
})

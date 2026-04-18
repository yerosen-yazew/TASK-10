// REQ: broadcast model envelope + payload contracts

import { describe, expect, it } from 'vitest'
import type {
  BroadcastEnvelope,
  ElementChangePayload,
  MembershipChangePayload,
  SessionLockPayload,
  ConflictNotifyPayload,
} from '@/models/broadcast'

describe('broadcast model', () => {
  it('supports element-change envelope payload', () => {
    const payload: ElementChangePayload = {
      operation: 'create',
      elementId: 'el-1',
      elementType: 'sticky-note',
      data: { text: 'hello' },
    }

    const envelope: BroadcastEnvelope<ElementChangePayload> = {
      type: 'element-change',
      tabId: 'tab-1',
      timestamp: '2026-01-01T00:00:00.000Z',
      roomId: 'room-1',
      payload,
    }

    expect(envelope.type).toBe('element-change')
    expect(envelope.payload.elementType).toBe('sticky-note')
  })

  it('supports membership + lock + conflict payloads', () => {
    const membership: MembershipChangePayload = {
      operation: 'approve',
      memberId: 'member-1',
      approvedBy: 'host-1',
      isSecondApproval: false,
    }
    const lock: SessionLockPayload = {
      action: 'lock',
      profileId: 'host-1',
    }
    const conflict: ConflictNotifyPayload = {
      conflictType: 'membership-race',
      resourceId: 'member-1',
      conflictingTabId: 'tab-2',
      message: 'Concurrent approval race',
    }

    expect(membership.operation).toBe('approve')
    expect(lock.action).toBe('lock')
    expect(conflict.conflictType).toBe('membership-race')
  })
})

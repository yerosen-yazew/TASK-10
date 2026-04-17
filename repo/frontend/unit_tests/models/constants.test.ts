// REQ: Runtime constant invariants used by validators, engines, and services

import { describe, expect, it } from 'vitest'
import {
  AUTOSAVE_INTERVAL_MS,
  BACKUP_FORMAT,
  BROADCAST_CHANNEL_NAME,
  DATA_CHANNEL_LABEL,
  DB_NAME,
  DB_VERSION,
  FORCED_SIGNOUT_MS,
  INACTIVITY_LOCK_MS,
  LS_PREFIX,
  MAX_BACKUP_SIZE_BYTES,
  MAX_BULK_IMPORT_ITEMS,
  MAX_CHAT_MESSAGES_RETAINED,
  MAX_COMMENTS_PER_THREAD,
  MAX_ELEMENTS_PER_ROOM,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGES_PER_ROOM,
  MAX_PINNED_MESSAGES,
  MAX_ROOM_MEMBERS,
  MAX_SNAPSHOTS_RETAINED,
  MIN_PASSPHRASE_LENGTH,
  PAIRING_PROTOCOL_VERSION,
  SECOND_REVIEWER_THRESHOLD,
  SNAPSHOT_INTERVAL_MS,
} from '@/models/constants'

describe('constants model', () => {
  it('uses expected guardrail values for room limits', () => {
    expect(MAX_ROOM_MEMBERS).toBe(20)
    expect(SECOND_REVIEWER_THRESHOLD).toBe(15)
    expect(MAX_ELEMENTS_PER_ROOM).toBe(2000)
    expect(MAX_IMAGES_PER_ROOM).toBe(50)
    expect(MAX_COMMENTS_PER_THREAD).toBe(200)
    expect(MAX_CHAT_MESSAGES_RETAINED).toBe(5000)
    expect(MAX_PINNED_MESSAGES).toBe(3)
    expect(MAX_SNAPSHOTS_RETAINED).toBe(48)
    expect(MAX_BULK_IMPORT_ITEMS).toBe(1000)
  })

  it('uses expected timing and passphrase constants', () => {
    expect(AUTOSAVE_INTERVAL_MS).toBe(10_000)
    expect(SNAPSHOT_INTERVAL_MS).toBe(300_000)
    expect(INACTIVITY_LOCK_MS).toBe(1_800_000)
    expect(FORCED_SIGNOUT_MS).toBe(28_800_000)
    expect(MIN_PASSPHRASE_LENGTH).toBe(8)
  })

  it('uses expected storage and transport constants', () => {
    expect(MAX_IMAGE_SIZE_BYTES).toBe(5 * 1024 * 1024)
    expect(MAX_BACKUP_SIZE_BYTES).toBe(200 * 1024 * 1024)
    expect(DB_NAME).toBe('forgeroom')
    expect(DB_VERSION).toBeGreaterThanOrEqual(1)
    expect(BROADCAST_CHANNEL_NAME).toBe('forgeroom:sync')
    expect(DATA_CHANNEL_LABEL).toBe('collab')
    expect(LS_PREFIX).toBe('forgeroom:')
    expect(BACKUP_FORMAT).toBe('forgeroom-backup-v1')
    expect(PAIRING_PROTOCOL_VERSION).toBe(1)
  })
})

// REQ: models barrel exports

import { describe, expect, it } from 'vitest'
import * as models from '@/models'

describe('models barrel', () => {
  it('re-exports constants and enums from domain modules', () => {
    expect(models.BACKUP_FORMAT).toBe('forgeroom-backup-v1')
    expect(models.ElementType.StickyNote).toBe('sticky-note')
    expect(models.RoomRole.Host).toBe('host')
    expect(models.SessionState.Active).toBe('active')
  })

  it('re-exports broadcast and collaboration related symbols', () => {
    expect(models.MAX_BULK_IMPORT_ITEMS).toBe(1000)
    expect(models.PAIRING_PROTOCOL_VERSION).toBe(1)
    expect(models.BROADCAST_CHANNEL_NAME).toContain('forgeroom')
  })
})

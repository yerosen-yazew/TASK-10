// REQ: validators barrel exports

import { describe, expect, it } from 'vitest'
import * as validators from '@/validators'

describe('validators barrel', () => {
  it('re-exports validators from all validator modules', () => {
    expect(typeof validators.validateMemberCount).toBe('function')
    expect(typeof validators.validateMembershipTransition).toBe('function')
    expect(typeof validators.validateElementCount).toBe('function')
    expect(typeof validators.validateImageSize).toBe('function')
    expect(typeof validators.validateCommentCount).toBe('function')
    expect(typeof validators.calculateMessagePruneCount).toBe('function')
    expect(typeof validators.calculateSnapshotPruneCount).toBe('function')
    expect(typeof validators.validateBackupFileSize).toBe('function')
    expect(typeof validators.validateBackupManifest).toBe('function')
    expect(typeof validators.validatePassphrase).toBe('function')
    expect(typeof validators.validateRoomCreatePayload).toBe('function')
    expect(typeof validators.validateJoinPayload).toBe('function')
  })
})

// REQ: serializers barrel exports

import { describe, expect, it } from 'vitest'
import * as serializers from '@/serializers'

describe('serializers barrel', () => {
  it('re-exports pairing, backup, and snapshot serializers', () => {
    expect(typeof serializers.decodePairingPayload).toBe('function')
    expect(typeof serializers.validatePairingPayload).toBe('function')
    expect(typeof serializers.buildBackupManifest).toBe('function')
    expect(typeof serializers.serializeBackup).toBe('function')
    expect(typeof serializers.deserializeBackup).toBe('function')
    expect(typeof serializers.createSnapshot).toBe('function')
    expect(typeof serializers.serializeSnapshot).toBe('function')
    expect(typeof serializers.deserializeSnapshot).toBe('function')
  })
})

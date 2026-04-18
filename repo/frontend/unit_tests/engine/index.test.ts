// REQ: engine barrel namespace exports

import { describe, expect, it } from 'vitest'
import * as engine from '@/engine'

describe('engine barrel', () => {
  it('exports all engine namespaces', () => {
    expect(engine.activityEngine).toBeDefined()
    expect(engine.snapshotEngine).toBeDefined()
    expect(engine.roomEngine).toBeDefined()
    expect(engine.membershipEngine).toBeDefined()
    expect(engine.elementEngine).toBeDefined()
    expect(engine.imageEngine).toBeDefined()
    expect(engine.commentEngine).toBeDefined()
    expect(engine.chatEngine).toBeDefined()
    expect(engine.presenceEngine).toBeDefined()
    expect(engine.autosaveScheduler).toBeDefined()
  })

  it('exposes representative callable members', () => {
    expect(typeof engine.roomEngine.createRoom).toBe('function')
    expect(typeof engine.presenceEngine.setPresence).toBe('function')
    expect(typeof engine.autosaveScheduler.startRoomScheduler).toBe('function')
  })
})

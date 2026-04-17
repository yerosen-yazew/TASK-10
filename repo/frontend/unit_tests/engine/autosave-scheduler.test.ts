// REQ: R16 — Auto-save every 10 seconds
// REQ: R17 — Snapshot every 5 minutes

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  startRoomScheduler,
  stopRoomScheduler,
  stopAll,
  isRoomSchedulerRunning,
} from '@/engine/autosave-scheduler'
import { AUTOSAVE_INTERVAL_MS, SNAPSHOT_INTERVAL_MS } from '@/models/constants'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  stopAll()
  vi.useRealTimers()
})

describe('startRoomScheduler', () => {
  it('invokes onAutoSave every 10 s', () => {
    const onAutoSave = vi.fn()
    const onSnapshot = vi.fn()
    startRoomScheduler('room-1', { onAutoSave, onSnapshot })

    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS)
    expect(onAutoSave).toHaveBeenCalledTimes(1)
    expect(onSnapshot).not.toHaveBeenCalled()

    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS * 2)
    expect(onAutoSave).toHaveBeenCalledTimes(3)
  })

  it('invokes onSnapshot every 5 min', () => {
    const onAutoSave = vi.fn()
    const onSnapshot = vi.fn()
    startRoomScheduler('room-1', { onAutoSave, onSnapshot })

    vi.advanceTimersByTime(SNAPSHOT_INTERVAL_MS - 1)
    expect(onSnapshot).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onSnapshot).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(SNAPSHOT_INTERVAL_MS)
    expect(onSnapshot).toHaveBeenCalledTimes(2)
  })

  it('re-starting a room resets the cadence', () => {
    const first = { onAutoSave: vi.fn(), onSnapshot: vi.fn() }
    const second = { onAutoSave: vi.fn(), onSnapshot: vi.fn() }
    startRoomScheduler('room-1', first)
    startRoomScheduler('room-1', second)
    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS)
    expect(first.onAutoSave).not.toHaveBeenCalled()
    expect(second.onAutoSave).toHaveBeenCalledTimes(1)
  })
})

describe('stopRoomScheduler', () => {
  it('stops further callbacks for a single room', () => {
    const onAutoSave = vi.fn()
    const onSnapshot = vi.fn()
    startRoomScheduler('room-1', { onAutoSave, onSnapshot })
    stopRoomScheduler('room-1')
    vi.advanceTimersByTime(SNAPSHOT_INTERVAL_MS * 2)
    expect(onAutoSave).not.toHaveBeenCalled()
    expect(onSnapshot).not.toHaveBeenCalled()
    expect(isRoomSchedulerRunning('room-1')).toBe(false)
  })
})

describe('stopAll', () => {
  it('stops schedulers for every room', () => {
    const a = { onAutoSave: vi.fn(), onSnapshot: vi.fn() }
    const b = { onAutoSave: vi.fn(), onSnapshot: vi.fn() }
    startRoomScheduler('room-1', a)
    startRoomScheduler('room-2', b)
    expect(isRoomSchedulerRunning('room-1')).toBe(true)
    expect(isRoomSchedulerRunning('room-2')).toBe(true)
    stopAll()
    vi.advanceTimersByTime(SNAPSHOT_INTERVAL_MS * 2)
    expect(a.onAutoSave).not.toHaveBeenCalled()
    expect(b.onAutoSave).not.toHaveBeenCalled()
    expect(isRoomSchedulerRunning('room-1')).toBe(false)
    expect(isRoomSchedulerRunning('room-2')).toBe(false)
  })
})

describe('autosave-scheduler — isolation & resilience', () => {
  it('isolates rooms — stopping one does not stop others', () => {
    const a = { onAutoSave: vi.fn(), onSnapshot: vi.fn() }
    const b = { onAutoSave: vi.fn(), onSnapshot: vi.fn() }
    startRoomScheduler('room-a', a)
    startRoomScheduler('room-b', b)
    stopRoomScheduler('room-a')
    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS)
    expect(a.onAutoSave).not.toHaveBeenCalled()
    expect(b.onAutoSave).toHaveBeenCalledTimes(1)
  })

  it('keeps the cadence alive after an async onAutoSave callback rejects', async () => {
    const onAutoSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('first boom'))
      .mockResolvedValue(undefined)
    const onSnapshot = vi.fn()
    startRoomScheduler('room-1', { onAutoSave, onSnapshot })
    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS)
    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS)
    expect(onAutoSave).toHaveBeenCalledTimes(2)
    expect(isRoomSchedulerRunning('room-1')).toBe(true)
  })

  it('stopRoomScheduler on an unknown roomId is a no-op', () => {
    expect(() => stopRoomScheduler('never-started')).not.toThrow()
    expect(isRoomSchedulerRunning('never-started')).toBe(false)
  })
})

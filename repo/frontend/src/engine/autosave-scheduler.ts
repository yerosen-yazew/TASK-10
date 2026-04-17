// REQ: R16 — Auto-save every 10 seconds
// REQ: R17 — Snapshot every 5 minutes

import { AUTOSAVE_INTERVAL_MS, SNAPSHOT_INTERVAL_MS } from '@/models/constants'

export interface SchedulerCallbacks {
  /** Called every AUTOSAVE_INTERVAL_MS ms (10 s). */
  onAutoSave: () => void | Promise<void>
  /** Called every SNAPSHOT_INTERVAL_MS ms (5 min). */
  onSnapshot: () => void | Promise<void>
}

interface RoomTimers {
  autosave: ReturnType<typeof setInterval>
  snapshot: ReturnType<typeof setInterval>
}

const timers = new Map<string, RoomTimers>()

/** Start autosave (10 s) + snapshot (5 min) cadences for a room. */
export function startRoomScheduler(roomId: string, callbacks: SchedulerCallbacks): void {
  stopRoomScheduler(roomId)
  const autosave = setInterval(() => {
    void callbacks.onAutoSave()
  }, AUTOSAVE_INTERVAL_MS)
  const snapshot = setInterval(() => {
    void callbacks.onSnapshot()
  }, SNAPSHOT_INTERVAL_MS)
  timers.set(roomId, { autosave, snapshot })
}

/** Stop cadences for a single room. */
export function stopRoomScheduler(roomId: string): void {
  const entry = timers.get(roomId)
  if (!entry) return
  clearInterval(entry.autosave)
  clearInterval(entry.snapshot)
  timers.delete(roomId)
}

/** Stop cadences for every room. */
export function stopAll(): void {
  for (const [, entry] of timers) {
    clearInterval(entry.autosave)
    clearInterval(entry.snapshot)
  }
  timers.clear()
}

/** Inspect whether a scheduler is running for a room (test-friendly). */
export function isRoomSchedulerRunning(roomId: string): boolean {
  return timers.has(roomId)
}

// REQ: R17 — Keep latest 48 snapshots

import { MAX_SNAPSHOTS_RETAINED } from '@/models/constants'

/**
 * Calculate how many old snapshots should be pruned to stay within retention limit.
 * @param currentSnapshotCount Total snapshots currently stored for the room.
 * @returns Number of oldest snapshots to remove (0 if within limit).
 */
export function calculateSnapshotPruneCount(currentSnapshotCount: number): number {
  return Math.max(0, currentSnapshotCount - MAX_SNAPSHOTS_RETAINED)
}

/**
 * Determine which snapshot IDs should be pruned (oldest first).
 * @param snapshotIds Snapshot IDs sorted by creation time (oldest first).
 * @param currentCount Total count of snapshots.
 * @returns Array of snapshot IDs to delete.
 */
export function getSnapshotIdsToPrune(snapshotIds: string[], currentCount: number): string[] {
  const pruneCount = calculateSnapshotPruneCount(currentCount)
  if (pruneCount <= 0) return []
  return snapshotIds.slice(0, pruneCount)
}

// REQ: Byte size estimation for backup export size checks and image validation

/**
 * Estimate the byte size of a JSON-serializable object.
 * Uses TextEncoder for accurate UTF-8 byte measurement.
 */
export function estimateJsonSize(obj: unknown): number {
  const json = JSON.stringify(obj)
  return new TextEncoder().encode(json).byteLength
}

/**
 * Format a byte count as a human-readable string (e.g., "4.2 MB").
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

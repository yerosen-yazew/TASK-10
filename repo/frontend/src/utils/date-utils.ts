// REQ: ISO timestamp helpers used throughout the domain

/** Return the current timestamp as an ISO 8601 string. */
export function nowISO(): string {
  return new Date().toISOString()
}

/** Parse an ISO 8601 string to a Date, or null if invalid. */
export function parseISO(iso: string): Date | null {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

/** Calculate milliseconds elapsed since an ISO timestamp. */
export function msElapsedSince(iso: string): number {
  const d = parseISO(iso)
  if (!d) return 0
  return Date.now() - d.getTime()
}

/** Check if an ISO timestamp is older than a given duration in milliseconds. */
export function isOlderThan(iso: string, durationMs: number): boolean {
  return msElapsedSince(iso) > durationMs
}

// REQ: R13, R18 — Safe logging utility: useful for debugging, no sensitive data leakage

const LOG_PREFIX = '[ForgeRoom]'
const LOG_LEVEL_KEY = 'forgeroom:logLevel'

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'
const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
}

/** Keys considered sensitive — values are redacted in log output. */
const SENSITIVE_KEYS = new Set([
  'passphrase',
  'password',
  'salt',
  'verifier',
  'key',
  'secret',
  'token',
  'credential',
  'pin',
])

/**
 * Recursively sanitize an object to redact sensitive fields.
 * Non-objects are returned as-is.
 */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[deep object]'
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1))

  const obj = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      result[k] = '[REDACTED]'
    } else {
      result[k] = sanitize(v, depth + 1)
    }
  }
  return result
}

function isLogLevel(value: unknown): value is LogLevel {
  return (
    value === 'debug' ||
    value === 'info' ||
    value === 'warn' ||
    value === 'error' ||
    value === 'silent'
  )
}

function readStorageLogLevel(): LogLevel | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(LOG_LEVEL_KEY)
    return isLogLevel(raw) ? raw : null
  } catch {
    return null
  }
}

function defaultLogLevel(): LogLevel {
  // Keep verbose logs in dev/test, suppress noisy info/debug in production.
  return import.meta.env.DEV ? 'debug' : 'warn'
}

function effectiveLogLevel(): LogLevel {
  const globalOverride = (globalThis as { __FORGEROOM_LOG_LEVEL__?: unknown }).__FORGEROOM_LOG_LEVEL__
  if (isLogLevel(globalOverride)) return globalOverride
  return readStorageLogLevel() ?? defaultLogLevel()
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_WEIGHT[level] >= LOG_LEVEL_WEIGHT[effectiveLogLevel()]
}

/** Test-only override for deterministic logger behavior in unit tests. */
export function __setLoggerLevelForTests(level: LogLevel | null): void {
  const ctx = globalThis as { __FORGEROOM_LOG_LEVEL__?: LogLevel }
  if (level === null) {
    delete ctx.__FORGEROOM_LOG_LEVEL__
    return
  }
  ctx.__FORGEROOM_LOG_LEVEL__ = level
}

export const logger = {
  /**
   * Debug-level log. Emitted when level <= debug.
   */
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.debug(`${LOG_PREFIX} [DEBUG]`, message, ...args.map((a) => sanitize(a)))
    }
  },

  /**
   * Info-level log. Emitted when level <= info.
   */
  info(message: string, ...args: unknown[]): void {
    if (shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.info(`${LOG_PREFIX} [INFO]`, message, ...args.map((a) => sanitize(a)))
    }
  },

  /**
   * Warning-level log. Emitted when level <= warn.
   */
  warn(message: string, ...args: unknown[]): void {
    if (shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn(`${LOG_PREFIX} [WARN]`, message, ...args.map((a) => sanitize(a)))
    }
  },

  /**
   * Error-level log. Emitted when level <= error.
   */
  error(message: string, ...args: unknown[]): void {
    if (shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error(`${LOG_PREFIX} [ERROR]`, message, ...args.map((a) => sanitize(a)))
    }
  },
}

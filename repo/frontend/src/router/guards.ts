// REQ: R12 — Route guards for locked vs unlocked session states
// REQ: R13 — Redirect to /profile when inactivity lock or forced sign-out fires

import type { Router, RouteLocationNormalized } from 'vue-router'
import { SessionState } from '@/models/profile'
import { useSessionStore } from '@/stores/session-store'

/**
 * Route names that require an active (unlocked) session.
 * Any route NOT in this set is considered public.
 */
export const AUTH_REQUIRED_ROUTES = new Set<string>([
  'room-list',
  'room-create',
  'room-join',
  'workspace',
  'workspace-settings',
  'workspace-backup',
])

/**
 * Pure guard logic — determines whether navigation should proceed.
 * Extracted as a standalone function for easy unit testing.
 *
 * @param routeName    - the target route name (string | null | symbol)
 * @param sessionState - the caller-supplied current session state
 * @param redirectPath - full path string to pass as redirect query on deny
 * @returns true to allow, or a route descriptor to redirect to /profile
 */
export function shouldAllowNavigation(
  routeName: string | null | symbol,
  sessionState: SessionState,
  redirectPath = ''
): true | { name: string; query: { redirect: string } } {
  if (!AUTH_REQUIRED_ROUTES.has(String(routeName))) return true
  if (sessionState === SessionState.Active) return true
  return { name: 'profile-select', query: { redirect: redirectPath } }
}

/**
 * Install the global session navigation guard on the given router.
 *
 * Pinia must be installed on the app before any navigation guard fires.
 * This is guaranteed because app.use(createPinia()) runs before app.use(router)
 * in main.ts, and guards only fire on navigation events after app.mount().
 *
 * The useSessionStore import is safe here — the store factory function is imported
 * at module evaluation time, but the store itself is only accessed (via `useSessionStore()`)
 * when the guard fires, by which point Pinia is initialized.
 */
export function installSessionGuard(router: Router): void {
  router.beforeEach((to: RouteLocationNormalized) => {
    const session = useSessionStore()
    return shouldAllowNavigation(to.name, session.sessionState, to.fullPath)
  })
}

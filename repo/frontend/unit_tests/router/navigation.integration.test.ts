// REQ: R12/R13 — Router navigation integration with real guards and session state

import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { routes } from '@/router'
import { installSessionGuard } from '@/router/guards'
import { SessionState } from '@/models/profile'
import { useSessionStore } from '@/stores/session-store'

const PUBLIC_PATHS = ['/', '/profile']
const GUARDED_PATHS = [
  '/rooms',
  '/rooms/create',
  '/rooms/join',
  '/workspace/room-42',
  '/workspace/room-42/settings',
  '/workspace/room-42/backup',
]

const LOCKED_STATES = [
  SessionState.NoProfile,
  SessionState.Locked,
  SessionState.InactivityLocked,
  SessionState.ForcedSignOut,
]

function createGuardedRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes,
  })
  installSessionGuard(router)
  return router
}

describe('router navigation integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it.each(PUBLIC_PATHS)(
    'allows public navigation to %s without active session',
    async (path) => {
      const router = createGuardedRouter()
      const session = useSessionStore()
      session.sessionState = SessionState.NoProfile

      await router.push(path)

      expect(router.currentRoute.value.path).toBe(path)
    }
  )

  it.each(LOCKED_STATES)(
    'redirects all guarded paths to /profile when session state is %s',
    async (state) => {
      const session = useSessionStore()
      session.sessionState = state

      for (const target of GUARDED_PATHS) {
        const router = createGuardedRouter()
        await router.push(target)

        expect(router.currentRoute.value.name).toBe('profile-select')
        expect(router.currentRoute.value.query.redirect).toBe(target)
      }
    }
  )

  it.each(GUARDED_PATHS)(
    'allows guarded navigation to %s when session is active',
    async (target) => {
      const router = createGuardedRouter()
      const session = useSessionStore()
      session.sessionState = SessionState.Active

      await router.push(target)

      expect(router.currentRoute.value.fullPath).toBe(target)
    }
  )

  it('preserves roomId params for workspace routes when active', async () => {
    const router = createGuardedRouter()
    const session = useSessionStore()
    session.sessionState = SessionState.Active

    await router.push('/workspace/alpha-room')
    expect(router.currentRoute.value.params.roomId).toBe('alpha-room')

    await router.push('/workspace/beta-room/settings')
    expect(router.currentRoute.value.params.roomId).toBe('beta-room')

    await router.push('/workspace/gamma-room/backup')
    expect(router.currentRoute.value.params.roomId).toBe('gamma-room')
  })
})

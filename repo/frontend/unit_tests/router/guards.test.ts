// REQ: R12 — Route guard logic for locked vs unlocked session states

import { describe, it, expect } from 'vitest'
import { shouldAllowNavigation, AUTH_REQUIRED_ROUTES } from '@/router/guards'
import { SessionState } from '@/models/profile'

describe('AUTH_REQUIRED_ROUTES', () => {
  it('includes room-list', () => {
    expect(AUTH_REQUIRED_ROUTES.has('room-list')).toBe(true)
  })

  it('includes workspace', () => {
    expect(AUTH_REQUIRED_ROUTES.has('workspace')).toBe(true)
  })

  it('includes room-create', () => {
    expect(AUTH_REQUIRED_ROUTES.has('room-create')).toBe(true)
  })

  it('includes room-join', () => {
    expect(AUTH_REQUIRED_ROUTES.has('room-join')).toBe(true)
  })

  it('includes workspace-settings', () => {
    expect(AUTH_REQUIRED_ROUTES.has('workspace-settings')).toBe(true)
  })

  it('includes workspace-backup', () => {
    expect(AUTH_REQUIRED_ROUTES.has('workspace-backup')).toBe(true)
  })

  it('does not include home or profile-select', () => {
    expect(AUTH_REQUIRED_ROUTES.has('home')).toBe(false)
    expect(AUTH_REQUIRED_ROUTES.has('profile-select')).toBe(false)
  })
})

describe('shouldAllowNavigation', () => {
  describe('public routes', () => {
    it('allows navigation to home regardless of session state', () => {
      const result = shouldAllowNavigation('home', SessionState.NoProfile)
      expect(result).toBe(true)
    })

    it('allows navigation to profile-select when locked', () => {
      expect(shouldAllowNavigation('profile-select', SessionState.Locked)).toBe(true)
    })

    it('allows navigation to profile-select when forced-sign-out', () => {
      expect(shouldAllowNavigation('profile-select', SessionState.ForcedSignOut)).toBe(true)
    })
  })

  describe('protected routes when unlocked', () => {
    it('allows room-list when Active', () => {
      expect(shouldAllowNavigation('room-list', SessionState.Active)).toBe(true)
    })

    it('allows workspace when Active', () => {
      expect(shouldAllowNavigation('workspace', SessionState.Active)).toBe(true)
    })
  })

  describe('protected routes when locked', () => {
    it('redirects room-list to profile-select when NoProfile', () => {
      const result = shouldAllowNavigation('room-list', SessionState.NoProfile, '/rooms')
      expect(result).not.toBe(true)
      expect((result as { name: string }).name).toBe('profile-select')
      expect((result as { query: { redirect: string } }).query.redirect).toBe('/rooms')
    })

    it('redirects workspace to profile-select when Locked', () => {
      const result = shouldAllowNavigation('workspace', SessionState.Locked, '/workspace/r1')
      expect(result).not.toBe(true)
      expect((result as { name: string }).name).toBe('profile-select')
    })

    it('redirects workspace to profile-select when InactivityLocked', () => {
      const result = shouldAllowNavigation('workspace', SessionState.InactivityLocked)
      expect(result).not.toBe(true)
      expect((result as { name: string }).name).toBe('profile-select')
    })

    it('redirects workspace to profile-select when ForcedSignOut', () => {
      const result = shouldAllowNavigation('workspace', SessionState.ForcedSignOut)
      expect(result).not.toBe(true)
      expect((result as { name: string }).name).toBe('profile-select')
    })

    it('redirects room-create to profile-select when NoProfile', () => {
      const result = shouldAllowNavigation('room-create', SessionState.NoProfile, '/rooms/create')
      expect(result).not.toBe(true)
      expect((result as { name: string }).name).toBe('profile-select')
    })

    it('redirects room-join to profile-select when Locked', () => {
      const result = shouldAllowNavigation('room-join', SessionState.Locked, '/rooms/join')
      expect(result).not.toBe(true)
      expect((result as { name: string }).name).toBe('profile-select')
    })

    it('redirects workspace-settings to profile-select when InactivityLocked', () => {
      const result = shouldAllowNavigation(
        'workspace-settings',
        SessionState.InactivityLocked,
        '/workspace/r1/settings'
      )
      expect(result).not.toBe(true)
      expect((result as { name: string }).name).toBe('profile-select')
    })

    it('redirects workspace-backup to profile-select when ForcedSignOut', () => {
      const result = shouldAllowNavigation(
        'workspace-backup',
        SessionState.ForcedSignOut,
        '/workspace/r1/backup'
      )
      expect(result).not.toBe(true)
      expect((result as { name: string }).name).toBe('profile-select')
    })
  })

  describe('edge cases', () => {
    it('allows navigation when routeName is null', () => {
      expect(shouldAllowNavigation(null, SessionState.NoProfile)).toBe(true)
    })

    it('allows navigation when routeName is an unrecognized symbol', () => {
      expect(shouldAllowNavigation(Symbol('unknown'), SessionState.NoProfile)).toBe(true)
    })

    it('redirect query contains the provided path', () => {
      const result = shouldAllowNavigation('room-list', SessionState.Locked, '/rooms?filter=active')
      expect((result as { query: { redirect: string } }).query.redirect).toBe('/rooms?filter=active')
    })
  })
})

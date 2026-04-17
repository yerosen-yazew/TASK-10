import { expect, test, type Page } from '@playwright/test'

const PUBLIC_PATHS = ['/', '/profile']
const GUARDED_PATHS = [
  '/rooms',
  '/rooms/create',
  '/rooms/join',
  '/workspace/e2e-room',
  '/workspace/e2e-room/settings',
  '/workspace/e2e-room/backup',
]

async function seedActiveSession(page: Page): Promise<void> {
  const lockAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const signOutAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

  await page.addInitScript(
    ({ lockAt: lockAtValue, signOutAt: signOutAtValue }: { lockAt: string; signOutAt: string }) => {
      localStorage.setItem('forgeroom:activeProfileId', 'e2e-profile')
      localStorage.setItem('forgeroom:sessionLockAt', lockAtValue)
      localStorage.setItem('forgeroom:signOutAt', signOutAtValue)
    },
    { lockAt, signOutAt }
  )
}

test('home route renders expected landing content', async ({ page }: { page: Page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'ForgeRoom' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Select Profile' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'My Rooms' })).toBeVisible()
})

test('public routes are reachable without active session', async ({ page }: { page: Page }) => {
  for (const path of PUBLIC_PATHS) {
    await page.goto(path)
    const url = new URL(page.url())
    expect(url.pathname).toBe(path)
  }
})

test('guarded routes redirect to /profile without active session', async ({ page }: { page: Page }) => {
  for (const target of GUARDED_PATHS) {
    await page.goto(target)
    await expect(page).toHaveURL(/\/profile\?redirect=/)

    const url = new URL(page.url())
    expect(url.pathname).toBe('/profile')
    expect(url.searchParams.get('redirect')).toBe(target)
  }
})

test('active session bypasses profile guard for all guarded routes', async ({ page }: { page: Page }) => {
  await seedActiveSession(page)

  for (const target of GUARDED_PATHS) {
    await page.goto(target)
    await page.waitForLoadState('domcontentloaded')

    const pathname = new URL(page.url()).pathname
    if (target.startsWith('/workspace/')) {
      // Workspace routes may internally reroute to /rooms when the room is not found,
      // but they should not be blocked by the session guard.
      expect(pathname).not.toBe('/profile')
    } else {
      expect(pathname).toBe(target)
    }
  }
})

// REQ: R1 / R2 / R11 / R20 — Router smoke test: route table (8 routes) + name resolution
import { describe, it, expect } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { routes } from '@/router'

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  })
}

describe('Router', () => {
  it('defines the expected number of routes', () => {
    expect(routes.length).toBe(8)
  })

  it('resolves / to the home route', async () => {
    const router = createTestRouter()
    const resolved = router.resolve('/')
    expect(resolved.name).toBe('home')
  })

  it('resolves /profile to the profile-select route', async () => {
    const router = createTestRouter()
    const resolved = router.resolve('/profile')
    expect(resolved.name).toBe('profile-select')
  })

  it('resolves /rooms to the room-list route', async () => {
    const router = createTestRouter()
    const resolved = router.resolve('/rooms')
    expect(resolved.name).toBe('room-list')
  })

  it('resolves /workspace/:roomId to the workspace route', async () => {
    const router = createTestRouter()
    const resolved = router.resolve('/workspace/test-room-123')
    expect(resolved.name).toBe('workspace')
    expect(resolved.params.roomId).toBe('test-room-123')
  })

  it('passes roomId as a prop to workspace route', () => {
    const workspaceRoute = routes.find(r => r.name === 'workspace')
    expect(workspaceRoute).toBeDefined()
    expect(workspaceRoute!.props).toBe(true)
  })

  it('resolves /rooms/create to the room-create route', () => {
    const router = createTestRouter()
    expect(router.resolve('/rooms/create').name).toBe('room-create')
  })

  it('resolves /rooms/join to the room-join route', () => {
    const router = createTestRouter()
    expect(router.resolve('/rooms/join').name).toBe('room-join')
  })

  it('resolves /workspace/:roomId/settings to the workspace-settings route', () => {
    const router = createTestRouter()
    const resolved = router.resolve('/workspace/r1/settings')
    expect(resolved.name).toBe('workspace-settings')
    expect(resolved.params.roomId).toBe('r1')
  })

  it('resolves /workspace/:roomId/backup to the workspace-backup route', () => {
    const router = createTestRouter()
    const resolved = router.resolve('/workspace/r1/backup')
    expect(resolved.name).toBe('workspace-backup')
    expect(resolved.params.roomId).toBe('r1')
  })
})

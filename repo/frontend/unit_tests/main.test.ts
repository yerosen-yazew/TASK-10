// REQ: R11/R15 — App bootstrap wiring uses Pinia + Router and mounts on #app

import { beforeEach, describe, expect, it, vi } from 'vitest'

const useMock = vi.fn()
const mountMock = vi.fn()
const appInstance = {
  use: useMock,
  mount: mountMock,
}

const createAppMock = vi.fn(() => appInstance)
const createPiniaMock = vi.fn()
const routerMock = { name: 'router-plugin' }

vi.mock('vue', () => ({
  createApp: createAppMock,
}))

vi.mock('pinia', () => ({
  createPinia: createPiniaMock,
}))

vi.mock('@/router', () => ({
  router: routerMock,
}))

vi.mock('@/App.vue', () => ({
  default: { name: 'RootApp' },
}))

describe('main bootstrap', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    useMock.mockImplementation(() => appInstance)
  })

  it('installs Pinia first, Router second, then mounts #app', async () => {
    const piniaPlugin = { name: 'pinia-plugin' }
    createPiniaMock.mockReturnValueOnce(piniaPlugin)

    await import('@/main')

    expect(createAppMock).toHaveBeenCalledTimes(1)
    expect(createPiniaMock).toHaveBeenCalledTimes(1)
    expect(useMock).toHaveBeenCalledTimes(2)
    expect(useMock).toHaveBeenNthCalledWith(1, piniaPlugin)
    expect(useMock).toHaveBeenNthCalledWith(2, routerMock)
    expect(mountMock).toHaveBeenCalledWith('#app')
  })
})

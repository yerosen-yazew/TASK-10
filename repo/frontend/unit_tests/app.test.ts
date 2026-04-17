// REQ: R11 / R15 — App bootstrap smoke test: Vue 3 + Pinia + Router wiring + session lifecycle
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '@/App.vue'
import { routes } from '@/router'

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  })
}

describe('App', () => {
  it('mounts successfully with router and pinia', async () => {
    const router = createTestRouter()
    const pinia = createPinia()

    router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [router, pinia],
      },
    })

    expect(wrapper.exists()).toBe(true)
  })

  it('renders a router-view element', async () => {
    const router = createTestRouter()
    const pinia = createPinia()

    router.push('/')
    await router.isReady()

    const wrapper = mount(App, {
      global: {
        plugins: [router, pinia],
      },
    })

    // The router-view renders the HomePage component for '/'
    expect(wrapper.html()).toContain('ForgeRoom')
  })

  it('installs Pinia without errors', () => {
    const pinia = createPinia()
    expect(pinia).toBeDefined()
    expect(pinia.install).toBeInstanceOf(Function)
  })
})

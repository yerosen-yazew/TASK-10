// REQ: R11 — Landing page: entry point linking to profile selection + rooms list

import { describe, it, expect } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import HomePage from '@/pages/HomePage.vue'

describe('HomePage', () => {
  it('renders the app title and subtitle', () => {
    const wrapper = mount(HomePage, {
      global: { stubs: { 'router-link': RouterLinkStub } },
    })
    expect(wrapper.find('h1').text()).toBe('ForgeRoom')
    expect(wrapper.text()).toContain('Offline Collaboration Workspace')
  })

  it('exposes a router-link to /profile', () => {
    const wrapper = mount(HomePage, {
      global: { stubs: { 'router-link': RouterLinkStub } },
    })
    const links = wrapper.findAllComponents(RouterLinkStub)
    const targets = links.map((l) => l.props('to'))
    expect(targets).toContain('/profile')
  })

  it('exposes a router-link to /rooms', () => {
    const wrapper = mount(HomePage, {
      global: { stubs: { 'router-link': RouterLinkStub } },
    })
    const links = wrapper.findAllComponents(RouterLinkStub)
    const targets = links.map((l) => l.props('to'))
    expect(targets).toContain('/rooms')
  })
})

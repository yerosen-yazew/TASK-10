// REQ: R11 / R14 / R18 — Shared banner stack for persistent notices (session lock, conflict, WebRTC failure)

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import AppBanner from '@/components/AppBanner.vue'
import { useUiStore } from '@/stores/ui-store'

describe('AppBanner', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders nothing when the banner stack is empty', () => {
    const wrapper = mount(AppBanner)
    expect(wrapper.find('.banner-stack').exists()).toBe(false)
  })

  it('renders one DOM node per banner', async () => {
    const wrapper = mount(AppBanner)
    const ui = useUiStore()
    ui.addBanner('Session locked', 'warning')
    ui.addBanner('Backup succeeded', 'success')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.banner').length).toBe(2)
  })

  it('applies the severity-specific class', async () => {
    const wrapper = mount(AppBanner)
    const ui = useUiStore()
    ui.addBanner('conflict', 'error')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.banner--error').exists()).toBe(true)
  })

  it('renders dismiss button only when the banner is dismissible', async () => {
    const wrapper = mount(AppBanner)
    const ui = useUiStore()
    ui.addBanner('No dismiss', 'info', false)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.banner__close').exists()).toBe(false)

    ui.addBanner('With dismiss', 'info', true)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.banner__close').exists()).toBe(true)
  })

  it('clicking dismiss removes the banner from the stack', async () => {
    const wrapper = mount(AppBanner)
    const ui = useUiStore()
    ui.addBanner('remove me', 'info', true)
    await wrapper.vm.$nextTick()
    await wrapper.find('.banner__close').trigger('click')
    expect(ui.banners.length).toBe(0)
  })
})

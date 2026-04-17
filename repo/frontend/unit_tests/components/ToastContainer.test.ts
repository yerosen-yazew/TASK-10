// REQ: R14 — Shared toast container reads from uiStore.toasts and exposes dismiss

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ToastContainer from '@/components/ToastContainer.vue'
import { useUiStore } from '@/stores/ui-store'

describe('ToastContainer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders no toasts when the store is empty', () => {
    const wrapper = mount(ToastContainer)
    expect(wrapper.findAll('.toast').length).toBe(0)
  })

  it('renders one DOM node per toast in the store', async () => {
    const wrapper = mount(ToastContainer)
    const ui = useUiStore()
    ui.toast.info('First')
    ui.toast.success('Second')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.toast').length).toBe(2)
    expect(wrapper.text()).toContain('First')
    expect(wrapper.text()).toContain('Second')
  })

  it('applies the type-specific class per toast', async () => {
    const wrapper = mount(ToastContainer)
    const ui = useUiStore()
    ui.toast.error('oops')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.toast--error').exists()).toBe(true)
  })

  it('auto-dismisses a toast after its durationMs', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ToastContainer)
    const ui = useUiStore()
    ui.toast.info('Bye', 100)
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.toast').length).toBe(1)
    vi.advanceTimersByTime(200)
    await flushPromises()
    expect(ui.toasts.length).toBe(0)
    vi.useRealTimers()
  })

  it('close button removes the toast immediately', async () => {
    const wrapper = mount(ToastContainer)
    const ui = useUiStore()
    ui.toast.info('Manual', 0) // 0 ms = no auto-dismiss
    await wrapper.vm.$nextTick()
    await wrapper.find('.toast__close').trigger('click')
    expect(ui.toasts.length).toBe(0)
  })

  it('uses role="region" with aria-live="polite" for SR announcements', () => {
    const wrapper = mount(ToastContainer)
    const root = wrapper.find('.toast-container')
    expect(root.attributes('role')).toBe('region')
    expect(root.attributes('aria-live')).toBe('polite')
  })
})

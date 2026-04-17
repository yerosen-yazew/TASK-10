// REQ: R18 — Rollback/leave confirmations use the ConfirmModal

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ConfirmModal from '@/components/ConfirmModal.vue'
import { useUiStore } from '@/stores/ui-store'

describe('ConfirmModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders nothing when no confirm is pending', () => {
    const wrapper = mount(ConfirmModal, { attachTo: document.body })
    expect(document.querySelector('.modal-overlay')).toBeNull()
    wrapper.unmount()
  })

  it('shows title, message, and the provided confirm/cancel labels', async () => {
    const wrapper = mount(ConfirmModal, { attachTo: document.body })
    const ui = useUiStore()
    ui.confirm({
      title: 'Really roll back?',
      message: 'This creates a new snapshot.',
      confirmLabel: 'Roll back',
      cancelLabel: 'Keep it',
    })
    await wrapper.vm.$nextTick()

    const overlay = document.querySelector('.modal-overlay')
    expect(overlay).not.toBeNull()
    expect(document.querySelector('#confirm-modal-title')?.textContent).toContain(
      'Really roll back?',
    )
    expect(document.body.textContent).toContain('This creates a new snapshot.')
    expect(document.body.textContent).toContain('Roll back')
    expect(document.body.textContent).toContain('Keep it')
    wrapper.unmount()
  })

  it('resolves the confirm promise with true when the confirm button is clicked', async () => {
    const wrapper = mount(ConfirmModal, { attachTo: document.body })
    const ui = useUiStore()
    const promise = ui.confirm({ title: 't', message: 'm' })
    await wrapper.vm.$nextTick()
    const confirmBtn = document.querySelector('.modal-btn--confirm') as HTMLButtonElement
    confirmBtn.click()
    expect(await promise).toBe(true)
    wrapper.unmount()
  })

  it('resolves the confirm promise with false when cancel is clicked', async () => {
    const wrapper = mount(ConfirmModal, { attachTo: document.body })
    const ui = useUiStore()
    const promise = ui.confirm({ title: 't', message: 'm' })
    await wrapper.vm.$nextTick()
    const cancelBtn = document.querySelector('.modal-btn--cancel') as HTMLButtonElement
    cancelBtn.click()
    expect(await promise).toBe(false)
    wrapper.unmount()
  })

  it('applies the danger class when danger:true is passed', async () => {
    const wrapper = mount(ConfirmModal, { attachTo: document.body })
    const ui = useUiStore()
    ui.confirm({ title: 't', message: 'm', danger: true })
    await wrapper.vm.$nextTick()
    expect(document.querySelector('.modal-btn--danger')).not.toBeNull()
    wrapper.unmount()
  })

  it('clicking the overlay dismisses (resolves false)', async () => {
    const wrapper = mount(ConfirmModal, { attachTo: document.body })
    const ui = useUiStore()
    const promise = ui.confirm({ title: 't', message: 'm' })
    await wrapper.vm.$nextTick()
    const overlay = document.querySelector('.modal-overlay') as HTMLElement
    // Simulate click where target === currentTarget
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(await promise).toBe(false)
    wrapper.unmount()
  })
})

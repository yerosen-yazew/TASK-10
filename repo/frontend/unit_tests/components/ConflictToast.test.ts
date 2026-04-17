// REQ: R18 — Conflict toast emits overwrite/discard/dismiss

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConflictToast from '@/components/ConflictToast.vue'

describe('ConflictToast', () => {
  it('renders the message and conflict alert role', () => {
    const wrapper = mount(ConflictToast, {
      props: { message: 'Another tab edited this.', conflictType: 'element-overwrite' },
    })
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.find('.conflict-toast__message').text()).toBe(
      'Another tab edited this.',
    )
  })

  it('emits overwrite when "Keep Mine" is clicked', async () => {
    const wrapper = mount(ConflictToast, {
      props: { message: 'x', conflictType: 'pin-collision' },
    })
    await wrapper.find('.conflict-toast__btn--overwrite').trigger('click')
    expect(wrapper.emitted('overwrite')).toHaveLength(1)
  })

  it('emits discard when "Discard Mine" is clicked', async () => {
    const wrapper = mount(ConflictToast, {
      props: { message: 'x', conflictType: 'pin-collision' },
    })
    await wrapper.find('.conflict-toast__btn--discard').trigger('click')
    expect(wrapper.emitted('discard')).toHaveLength(1)
  })

  it('emits dismiss when the close button is clicked', async () => {
    const wrapper = mount(ConflictToast, {
      props: { message: 'x', conflictType: 'rollback-collision' },
    })
    await wrapper.find('.conflict-toast__close').trigger('click')
    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('close button has an accessible label', () => {
    const wrapper = mount(ConflictToast, {
      props: { message: 'x', conflictType: 'element-overwrite' },
    })
    expect(wrapper.find('.conflict-toast__close').attributes('aria-label')).toBe(
      'Dismiss',
    )
  })
})

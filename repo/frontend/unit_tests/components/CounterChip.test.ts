// REQ: R6, R7, R8 — Counter chip used next to cap-bounded lists (elements, comments, pins)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CounterChip from '@/components/CounterChip.vue'

describe('CounterChip', () => {
  it('renders the plain count when no max is provided', () => {
    const wrapper = mount(CounterChip, { props: { count: 3 } })
    expect(wrapper.text()).toBe('3')
    expect(wrapper.classes()).not.toContain('counter-chip--cap')
  })

  it('renders count and appends a label when provided', () => {
    const wrapper = mount(CounterChip, {
      props: { count: 5, label: 'images' },
    })
    expect(wrapper.text()).toBe('5 images')
  })

  it('applies the cap class when count reaches the max', () => {
    const wrapper = mount(CounterChip, { props: { count: 3, max: 3 } })
    expect(wrapper.classes()).toContain('counter-chip--cap')
  })

  it('does not apply the cap class when count < max', () => {
    const wrapper = mount(CounterChip, { props: { count: 2, max: 3 } })
    expect(wrapper.classes()).not.toContain('counter-chip--cap')
  })

  it('displays "max+" when count exceeds the max', () => {
    const wrapper = mount(CounterChip, { props: { count: 5, max: 3 } })
    expect(wrapper.text()).toBe('3+')
  })
})

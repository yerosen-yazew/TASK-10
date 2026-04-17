// REQ: R7/R8/R14/R15 — LimitIndicator: percentage display, warning color at ≥90%, label format

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LimitIndicator from '@/components/LimitIndicator.vue'

describe('LimitIndicator', () => {
  it('renders correct label with toLocaleString formatting', () => {
    const wrapper = mount(LimitIndicator, {
      props: { current: 1847, max: 2000, label: 'elements' },
    })
    const text = wrapper.text()
    expect(text).toContain('2,000')
    expect(text).toContain('elements')
  })

  it('shows 0 / max when current is 0', () => {
    const wrapper = mount(LimitIndicator, {
      props: { current: 0, max: 100, label: 'items' },
    })
    expect(wrapper.text()).toContain('0')
    expect(wrapper.text()).toContain('100')
  })

  it('does NOT apply warning class below 90%', () => {
    const wrapper = mount(LimitIndicator, {
      props: { current: 89, max: 100, label: 'items' },
    })
    expect(wrapper.find('.limit-indicator__bar-fill--warning').exists()).toBe(false)
    expect(wrapper.find('.limit-indicator__bar-fill--full').exists()).toBe(false)
  })

  it('applies warning class at exactly 90%', () => {
    const wrapper = mount(LimitIndicator, {
      props: { current: 90, max: 100, label: 'items' },
    })
    expect(wrapper.find('.limit-indicator__bar-fill--warning').exists()).toBe(true)
  })

  it('applies warning class between 90% and 100%', () => {
    const wrapper = mount(LimitIndicator, {
      props: { current: 95, max: 100, label: 'items' },
    })
    expect(wrapper.find('.limit-indicator__bar-fill--warning').exists()).toBe(true)
  })

  it('applies full class at 100%', () => {
    const wrapper = mount(LimitIndicator, {
      props: { current: 100, max: 100, label: 'items' },
    })
    expect(wrapper.find('.limit-indicator__bar-fill--full').exists()).toBe(true)
  })

  it('bar fill width is proportional to current/max', () => {
    const wrapper = mount(LimitIndicator, {
      props: { current: 50, max: 100, label: 'items' },
    })
    const fill = wrapper.find('.limit-indicator__bar-fill')
    expect(fill.exists()).toBe(true)
    const style = fill.attributes('style') ?? ''
    expect(style).toContain('50%')
  })

  it('caps bar fill at 100% when current exceeds max', () => {
    const wrapper = mount(LimitIndicator, {
      props: { current: 110, max: 100, label: 'items' },
    })
    const fill = wrapper.find('.limit-indicator__bar-fill')
    const style = fill.attributes('style') ?? ''
    expect(style).toContain('100%')
  })

  it('renders "1,847 / 2,000 elements" label correctly', () => {
    const wrapper = mount(LimitIndicator, {
      props: { current: 1847, max: 2000, label: 'elements' },
    })
    const text = wrapper.text()
    expect(text).toMatch(/1[,.]847/)
    expect(text).toMatch(/2[,.]000/)
  })
})

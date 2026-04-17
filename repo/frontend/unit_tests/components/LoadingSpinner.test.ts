// REQ: R11 / R2 / R20 — Shared loading indicator for async states (profile unlock, rooms fetch, backup persist)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoadingSpinner from '@/components/LoadingSpinner.vue'

describe('LoadingSpinner', () => {
  it('renders with role="status" and accessible label for screen readers', () => {
    const wrapper = mount(LoadingSpinner)
    const root = wrapper.find('.loading-spinner')
    expect(root.attributes('role')).toBe('status')
    expect(root.attributes('aria-label')).toBe('Loading')
  })

  it('defaults to the md size when no size prop is supplied', () => {
    const wrapper = mount(LoadingSpinner)
    expect(wrapper.classes()).toContain('loading-spinner--md')
  })

  it('applies the sm size class when size="sm"', () => {
    const wrapper = mount(LoadingSpinner, { props: { size: 'sm' } })
    expect(wrapper.classes()).toContain('loading-spinner--sm')
  })

  it('applies the lg size class when size="lg"', () => {
    const wrapper = mount(LoadingSpinner, { props: { size: 'lg' } })
    expect(wrapper.classes()).toContain('loading-spinner--lg')
  })

  it('contains an SVG circle element', () => {
    const wrapper = mount(LoadingSpinner)
    expect(wrapper.find('svg circle').exists()).toBe(true)
  })
})

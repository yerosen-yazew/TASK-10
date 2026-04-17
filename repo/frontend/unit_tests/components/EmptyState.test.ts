// REQ: R2 / R7 / R9 / R12 — Shared empty state primitive (rooms, activity feed, comments, snapshots)

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyState from '@/components/EmptyState.vue'

describe('EmptyState', () => {
  it('renders the title always', () => {
    const wrapper = mount(EmptyState, { props: { title: 'No rooms yet' } })
    expect(wrapper.find('.empty-state__title').text()).toBe('No rooms yet')
  })

  it('renders description when provided', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'x', description: 'Make your first room' },
    })
    expect(wrapper.find('.empty-state__desc').text()).toBe('Make your first room')
  })

  it('omits description when not provided', () => {
    const wrapper = mount(EmptyState, { props: { title: 'x' } })
    expect(wrapper.find('.empty-state__desc').exists()).toBe(false)
  })

  it('renders action button when actionLabel is set', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'x', actionLabel: 'Create room' },
    })
    const btn = wrapper.find('.empty-state__action')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('Create room')
  })

  it('emits "action" when the action button is clicked', async () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'x', actionLabel: 'Create' },
    })
    await wrapper.find('.empty-state__action').trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })

  it('does not render action button when actionLabel is absent', () => {
    const wrapper = mount(EmptyState, { props: { title: 'x' } })
    expect(wrapper.find('.empty-state__action').exists()).toBe(false)
  })

  it('renders the icon when provided', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'x', icon: '🏠' },
    })
    expect(wrapper.find('.empty-state__icon').text()).toBe('🏠')
  })
})

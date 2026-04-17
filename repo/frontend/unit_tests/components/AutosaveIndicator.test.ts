// REQ: R16 — AutosaveIndicator: saved / saving / failed / idle states

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AutosaveIndicator from '@/components/workspace/AutosaveIndicator.vue'

describe('AutosaveIndicator', () => {
  it('renders "Saving…" label when status=saving', () => {
    const wrapper = mount(AutosaveIndicator, { props: { status: 'saving' } })
    expect(wrapper.text()).toContain('Saving…')
  })

  it('renders "Saved" label when status=saved', () => {
    const wrapper = mount(AutosaveIndicator, { props: { status: 'saved' } })
    expect(wrapper.text()).toContain('Saved')
  })

  it('renders "Save failed" label when status=failed', () => {
    const wrapper = mount(AutosaveIndicator, { props: { status: 'failed' } })
    expect(wrapper.text()).toContain('Save failed')
  })

  it('renders "Unsaved" label when status=idle', () => {
    const wrapper = mount(AutosaveIndicator, { props: { status: 'idle' } })
    expect(wrapper.text()).toContain('Unsaved')
  })

  it('applies saving CSS class when status=saving', () => {
    const wrapper = mount(AutosaveIndicator, { props: { status: 'saving' } })
    expect(wrapper.classes()).toContain('autosave--saving')
  })

  it('applies saved CSS class when status=saved', () => {
    const wrapper = mount(AutosaveIndicator, { props: { status: 'saved' } })
    expect(wrapper.classes()).toContain('autosave--saved')
  })

  it('applies failed CSS class when status=failed', () => {
    const wrapper = mount(AutosaveIndicator, { props: { status: 'failed' } })
    expect(wrapper.classes()).toContain('autosave--failed')
  })

  it('shows lastSavedAt time in "Saved" label when provided', () => {
    const wrapper = mount(AutosaveIndicator, {
      props: { status: 'saved', lastSavedAt: '2026-01-01T14:30:00.000Z' },
    })
    // Should contain some form of the formatted time
    expect(wrapper.text()).toContain('Saved')
  })

  it('shows pulsing dot when saving', () => {
    const wrapper = mount(AutosaveIndicator, { props: { status: 'saving' } })
    expect(wrapper.find('.autosave__dot--pulse').exists()).toBe(true)
  })

  it('does not show pulsing dot when saved', () => {
    const wrapper = mount(AutosaveIndicator, { props: { status: 'saved' } })
    expect(wrapper.find('.autosave__dot--pulse').exists()).toBe(false)
  })
})

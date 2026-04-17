// REQ: R9/R10/R11 — TabFilter: renders tabs, active class, emits update:modelValue

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TabFilter from '@/components/TabFilter.vue'

const tabs = [
  { key: 'all', label: 'All' },
  { key: 'elements', label: 'Elements' },
  { key: 'comments', label: 'Comments' },
]

describe('TabFilter', () => {
  it('renders all tabs', () => {
    const wrapper = mount(TabFilter, {
      props: { tabs, modelValue: 'all' },
    })
    for (const tab of tabs) {
      expect(wrapper.text()).toContain(tab.label)
    }
  })

  it('active tab has active CSS class', () => {
    const wrapper = mount(TabFilter, {
      props: { tabs, modelValue: 'elements' },
    })
    const buttons = wrapper.findAll('button')
    const activeBtn = buttons.find((b) => b.text() === 'Elements')
    expect(activeBtn?.classes()).toEqual(
      expect.arrayContaining([expect.stringContaining('active')])
    )
  })

  it('inactive tabs do not have active class', () => {
    const wrapper = mount(TabFilter, {
      props: { tabs, modelValue: 'all' },
    })
    const buttons = wrapper.findAll('button')
    const inactiveBtn = buttons.find((b) => b.text() === 'Elements')
    expect(inactiveBtn?.classes().some((c) => c.includes('active'))).toBe(false)
  })

  it('clicking a tab emits update:modelValue with correct key', async () => {
    const wrapper = mount(TabFilter, {
      props: { tabs, modelValue: 'all' },
    })
    const buttons = wrapper.findAll('button')
    const commentsBtn = buttons.find((b) => b.text() === 'Comments')!
    await commentsBtn.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['comments'])
  })

  it('clicking already-active tab still emits update:modelValue', async () => {
    const wrapper = mount(TabFilter, {
      props: { tabs, modelValue: 'all' },
    })
    const allBtn = wrapper.findAll('button').find((b) => b.text() === 'All')!
    await allBtn.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['all'])
  })

  it('renders the correct number of buttons', () => {
    const wrapper = mount(TabFilter, {
      props: { tabs, modelValue: 'all' },
    })
    expect(wrapper.findAll('button')).toHaveLength(tabs.length)
  })
})

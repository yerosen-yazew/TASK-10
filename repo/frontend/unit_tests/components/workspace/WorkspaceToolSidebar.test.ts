// REQ: R5 — Left tool palette emits tool-selected for each canvas tool

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkspaceToolSidebar from '@/components/workspace/WorkspaceToolSidebar.vue'

describe('WorkspaceToolSidebar', () => {
  it('renders a button for each of the 5 tools (select, sticky, arrow, pen, image)', () => {
    const wrapper = mount(WorkspaceToolSidebar, { props: { activeTool: 'select' } })
    expect(wrapper.findAll('.tool-sidebar__btn').length).toBe(5)
  })

  it('applies the active class to the currently selected tool', () => {
    const wrapper = mount(WorkspaceToolSidebar, { props: { activeTool: 'pen' } })
    const activeBtns = wrapper.findAll('.tool-sidebar__btn--active')
    expect(activeBtns.length).toBe(1)
    expect(activeBtns[0].attributes('aria-pressed')).toBe('true')
  })

  it('emits tool-selected with the tool key when a button is clicked', async () => {
    const wrapper = mount(WorkspaceToolSidebar, { props: { activeTool: 'select' } })
    const buttons = wrapper.findAll('.tool-sidebar__btn')
    await buttons[1].trigger('click') // sticky
    await buttons[2].trigger('click') // arrow
    const events = wrapper.emitted('tool-selected')
    expect(events).toBeTruthy()
    expect(events![0]).toEqual(['sticky'])
    expect(events![1]).toEqual(['arrow'])
  })

  it('disables non-select tools when disabled prop is true', () => {
    const wrapper = mount(WorkspaceToolSidebar, {
      props: { activeTool: 'select', disabled: true },
    })
    const buttons = wrapper.findAll('.tool-sidebar__btn')
    expect(buttons[0].attributes('disabled')).toBeUndefined() // select stays enabled
    expect(buttons[1].attributes('disabled')).toBeDefined() // sticky disabled
    expect(buttons[4].attributes('disabled')).toBeDefined() // image disabled
  })

  it('exposes an aria-label on the toolbar for accessibility', () => {
    const wrapper = mount(WorkspaceToolSidebar, { props: { activeTool: 'select' } })
    expect(wrapper.find('.tool-sidebar').attributes('aria-label')).toBe('Drawing tools')
  })
})

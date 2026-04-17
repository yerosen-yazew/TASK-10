// REQ: R5/R16/R17 — Workspace toolbar emits tool/backup/snapshot actions and shows autosave state

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkspaceToolbar from '@/components/workspace/WorkspaceToolbar.vue'
import { MAX_ELEMENTS_PER_ROOM } from '@/models/constants'

const baseProps = {
  roomName: 'My Room',
  activeTool: 'select' as const,
  elementCount: 10,
  memberCount: 3,
}

describe('WorkspaceToolbar', () => {
  it('emits tool-change when a different tool is clicked', async () => {
    const wrapper = mount(WorkspaceToolbar, { props: baseProps })
    const buttons = wrapper.findAll('.ws-toolbar__tool')
    await buttons[1].trigger('click') // sticky
    expect(wrapper.emitted('tool-change')![0]).toEqual(['sticky'])
  })

  it('emits open-backup when the backup button is clicked', async () => {
    const wrapper = mount(WorkspaceToolbar, { props: baseProps })
    await wrapper.find('[data-testid="backup-btn"]').trigger('click')
    expect(wrapper.emitted('open-backup')).toHaveLength(1)
  })

  it('emits open-snapshots only when canRollback is true', async () => {
    const wrapper = mount(WorkspaceToolbar, {
      props: { ...baseProps, canRollback: true },
    })
    const snapshotBtn = wrapper
      .findAll('.ws-toolbar__action-btn')
      .find((b) => b.text() === 'Snapshots')!
    await snapshotBtn.trigger('click')
    expect(wrapper.emitted('open-snapshots')).toHaveLength(1)
  })

  it('hides the snapshot button when canRollback is false', () => {
    const wrapper = mount(WorkspaceToolbar, {
      props: { ...baseProps, canRollback: false },
    })
    expect(
      wrapper.findAll('.ws-toolbar__action-btn').find((b) => b.text() === 'Snapshots'),
    ).toBeUndefined()
  })

  it('emits open-members when member chip is clicked', async () => {
    const wrapper = mount(WorkspaceToolbar, { props: baseProps })
    await wrapper.find('.ws-toolbar__member-chip').trigger('click')
    expect(wrapper.emitted('open-members')).toHaveLength(1)
  })

  it('shows the autosave indicator when status is not idle', () => {
    const wrapper = mount(WorkspaceToolbar, {
      props: { ...baseProps, autosaveStatus: 'saving' as const },
    })
    expect(wrapper.find('[data-testid="autosave-indicator"]').exists()).toBe(true)
  })

  it('hides the autosave indicator when status is idle', () => {
    const wrapper = mount(WorkspaceToolbar, {
      props: { ...baseProps, autosaveStatus: 'idle' as const },
    })
    expect(wrapper.find('[data-testid="autosave-indicator"]').exists()).toBe(false)
  })

  it('disables non-select tools at element cap (R5)', () => {
    const wrapper = mount(WorkspaceToolbar, {
      props: { ...baseProps, elementCount: MAX_ELEMENTS_PER_ROOM },
    })
    const buttons = wrapper.findAll('.ws-toolbar__tool')
    expect(buttons[0].attributes('disabled')).toBeUndefined() // select
    expect(buttons[1].attributes('disabled')).toBeDefined() // sticky
    expect(buttons[3].attributes('disabled')).toBeDefined() // pen
  })

  it('disables all tools when disabled prop is true', () => {
    const wrapper = mount(WorkspaceToolbar, {
      props: { ...baseProps, disabled: true },
    })
    const buttons = wrapper.findAll('.ws-toolbar__tool')
    for (const b of buttons) {
      expect(b.attributes('disabled')).toBeDefined()
    }
  })

  it('shows the room name and member count', () => {
    const wrapper = mount(WorkspaceToolbar, {
      props: { ...baseProps, roomName: 'Sprint Planning', memberCount: 7 },
    })
    expect(wrapper.find('.ws-toolbar__room-name').text()).toBe('Sprint Planning')
    expect(wrapper.find('.ws-toolbar__member-chip').text()).toContain('7')
  })

  it('emits open-pairing when the Pair button is clicked', async () => {
    const wrapper = mount(WorkspaceToolbar, { props: baseProps })
    const pairBtn = wrapper.find('[data-testid="pair-btn"]')
    expect(pairBtn.exists()).toBe(true)
    await pairBtn.trigger('click')
    expect(wrapper.emitted('open-pairing')).toHaveLength(1)
  })

  it('disables the Pair button when disabled prop is true', () => {
    const wrapper = mount(WorkspaceToolbar, {
      props: { ...baseProps, disabled: true },
    })
    const pairBtn = wrapper.find('[data-testid="pair-btn"]')
    expect(pairBtn.exists()).toBe(true)
    expect(pairBtn.attributes('disabled')).toBeDefined()
  })
})

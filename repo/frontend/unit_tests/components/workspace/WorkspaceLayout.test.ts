// REQ: R5/R7/R8/R9/R10 — Workspace outer shell renders slots and toggles right panel
// REQ: R17 — openPanel expose allows toolbar shortcuts to switch the right panel

import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout.vue'

describe('WorkspaceLayout', () => {
  it('renders all named slots when provided', () => {
    const wrapper = mount(WorkspaceLayout, {
      props: { roomName: 'Test room' },
      slots: {
        'tool-sidebar': '<div class="slot-tool">tool</div>',
        toolbar: '<div class="slot-toolbar">tb</div>',
        canvas: '<div class="slot-canvas">cv</div>',
        'chat-panel': '<div class="slot-chat">chat body</div>',
        'comment-drawer': '<div class="slot-drawer">drawer</div>',
      },
    })
    expect(wrapper.find('.slot-tool').exists()).toBe(true)
    expect(wrapper.find('.slot-toolbar').exists()).toBe(true)
    expect(wrapper.find('.slot-canvas').exists()).toBe(true)
    expect(wrapper.find('.slot-drawer').exists()).toBe(true)
  })

  it('defaults to the chat right panel visible', () => {
    const wrapper = mount(WorkspaceLayout, {
      slots: { 'chat-panel': '<div class="slot-chat">chat body</div>' },
    })
    expect(wrapper.find('.workspace-layout__right').exists()).toBe(true)
    expect(wrapper.find('.slot-chat').exists()).toBe(true)
  })

  it('switches to the activity panel when the activity tab is clicked', async () => {
    const wrapper = mount(WorkspaceLayout, {
      slots: {
        'chat-panel': '<div class="slot-chat">chat</div>',
        'activity-panel': '<div class="slot-activity">activity</div>',
      },
    })
    const tabs = wrapper.findAll('.workspace-layout__panel-tab')
    const activityTab = tabs.find((t) => t.text() === 'activity')!
    await activityTab.trigger('click')
    expect(wrapper.find('.slot-activity').exists()).toBe(true)
    expect(wrapper.find('.slot-chat').exists()).toBe(false)
  })

  it('closes the right panel when the close button is clicked', async () => {
    const wrapper = mount(WorkspaceLayout, {
      slots: { 'chat-panel': '<div class="slot-chat">chat</div>' },
    })
    expect(wrapper.find('.workspace-layout__right').exists()).toBe(true)
    await wrapper.find('.workspace-layout__close-panel').trigger('click')
    expect(wrapper.find('.workspace-layout__right').exists()).toBe(false)
  })

  it('renders four panel tabs (chat, activity, members, snapshots)', () => {
    const wrapper = mount(WorkspaceLayout, {
      slots: { 'chat-panel': '<div>x</div>' },
    })
    const tabs = wrapper.findAll('.workspace-layout__panel-tab')
    expect(tabs.map((t) => t.text())).toEqual(['chat', 'activity', 'members', 'snapshots'])
  })

  it('exposes openPanel that switches the right panel to the given tab', async () => {
    const wrapper = mount(WorkspaceLayout, {
      slots: {
        'chat-panel': '<div class="slot-chat">chat</div>',
        'snapshot-drawer': '<div class="slot-snap">snapshots</div>',
      },
    })
    // Default: chat panel is visible
    expect(wrapper.find('.slot-chat').exists()).toBe(true)
    expect(wrapper.find('.slot-snap').exists()).toBe(false)
    // Call exposed openPanel
    ;(wrapper.vm as any).openPanel('snapshots')
    await nextTick()
    expect(wrapper.find('.slot-snap').exists()).toBe(true)
    expect(wrapper.find('.slot-chat').exists()).toBe(false)
  })

  it('exposes openPanel that switches the right panel to members', async () => {
    const wrapper = mount(WorkspaceLayout, {
      slots: {
        'chat-panel': '<div class="slot-chat">chat</div>',
        'member-list': '<div class="slot-members">members</div>',
      },
    })
    ;(wrapper.vm as any).openPanel('members')
    await nextTick()
    expect(wrapper.find('.slot-members').exists()).toBe(true)
    expect(wrapper.find('.slot-chat').exists()).toBe(false)
  })
})

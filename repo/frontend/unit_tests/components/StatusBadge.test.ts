// REQ: R3 — Member/peer status badge

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '@/components/StatusBadge.vue'
import { MembershipState } from '@/models/room'

describe('StatusBadge', () => {
  it('renders "Active" label and the active color class', () => {
    const wrapper = mount(StatusBadge, {
      props: { status: MembershipState.Active },
    })
    expect(wrapper.text()).toBe('Active')
    expect(wrapper.classes()).toContain('status-badge--active')
  })

  it('renders "Pending" label for Requested', () => {
    const wrapper = mount(StatusBadge, {
      props: { status: MembershipState.Requested },
    })
    expect(wrapper.text()).toBe('Pending')
    expect(wrapper.classes()).toContain('status-badge--pending')
  })

  it('renders the long 2nd-approval label for PendingSecondApproval', () => {
    const wrapper = mount(StatusBadge, {
      props: { status: MembershipState.PendingSecondApproval },
    })
    expect(wrapper.text()).toBe('Needs 2nd Approval')
    expect(wrapper.classes()).toContain('status-badge--pending')
  })

  it('renders neutral style for Left', () => {
    const wrapper = mount(StatusBadge, {
      props: { status: MembershipState.Left },
    })
    expect(wrapper.classes()).toContain('status-badge--neutral')
    expect(wrapper.text()).toBe('Left')
  })

  it('renders error style for Rejected', () => {
    const wrapper = mount(StatusBadge, {
      props: { status: MembershipState.Rejected },
    })
    expect(wrapper.classes()).toContain('status-badge--error')
  })

  it('supports peer connection states (connected / failed)', () => {
    const connected = mount(StatusBadge, { props: { status: 'connected' } })
    expect(connected.text()).toBe('Connected')
    expect(connected.classes()).toContain('status-badge--active')

    const failed = mount(StatusBadge, { props: { status: 'failed' } })
    expect(failed.text()).toBe('Failed')
    expect(failed.classes()).toContain('status-badge--error')
  })

  it('applies the sm size class when size="sm"', () => {
    const wrapper = mount(StatusBadge, {
      props: { status: MembershipState.Active, size: 'sm' },
    })
    expect(wrapper.classes()).toContain('status-badge--sm')
  })

  it('falls back to the raw status label and neutral class for unknown values', () => {
    const wrapper = mount(StatusBadge, { props: { status: 'something-new' } })
    expect(wrapper.text()).toBe('something-new')
    expect(wrapper.classes()).toContain('status-badge--neutral')
  })
})

// REQ: R5, R20 — Inline validation error display for forms and import rows

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import InlineValidation from '@/components/InlineValidation.vue'
import type { FieldError } from '@/models/validation'

function err(field: string, message: string): FieldError {
  return { field, message, code: 'required' }
}

describe('InlineValidation', () => {
  it('renders nothing when errors is empty', () => {
    const wrapper = mount(InlineValidation, { props: { errors: [] } })
    expect(wrapper.find('.inline-validation').exists()).toBe(false)
  })

  it('renders each error message when no field scope is applied', () => {
    const errors = [err('name', 'Name is required'), err('desc', 'Desc too long')]
    const wrapper = mount(InlineValidation, { props: { errors } })
    const items = wrapper.findAll('.inline-validation__error')
    expect(items.length).toBe(2)
    expect(items[0].text()).toBe('Name is required')
    expect(items[1].text()).toBe('Desc too long')
  })

  it('filters errors to the named field when field prop is set', () => {
    const errors = [err('name', 'Name required'), err('desc', 'Desc required')]
    const wrapper = mount(InlineValidation, {
      props: { errors, field: 'desc' },
    })
    const items = wrapper.findAll('.inline-validation__error')
    expect(items.length).toBe(1)
    expect(items[0].text()).toBe('Desc required')
  })

  it('uses role="alert" for accessibility', () => {
    const wrapper = mount(InlineValidation, {
      props: { errors: [err('a', 'oops')] },
    })
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })

  it('renders nothing when the scoped field has no matching errors', () => {
    const wrapper = mount(InlineValidation, {
      props: { errors: [err('other', 'x')], field: 'missing' },
    })
    expect(wrapper.find('.inline-validation').exists()).toBe(false)
  })
})

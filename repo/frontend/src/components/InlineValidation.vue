<script setup lang="ts">
// REQ: Shared feedback primitive — inline field-level validation error display
import type { FieldError } from '@/models/validation'

interface Props {
  /** Array of FieldError objects from a ValidationResult. */
  errors: FieldError[]
  /** If set, only show errors for this field name. */
  field?: string
}

const props = withDefaults(defineProps<Props>(), {
  field: undefined,
})

import { computed } from 'vue'

const visibleErrors = computed(() => {
  if (props.field) {
    return props.errors.filter((e) => e.field === props.field)
  }
  return props.errors
})
</script>

<template>
  <div v-if="visibleErrors.length > 0" class="inline-validation" role="alert">
    <p
      v-for="(err, idx) in visibleErrors"
      :key="idx"
      class="inline-validation__error"
    >
      {{ err.message }}
    </p>
  </div>
</template>

<style scoped>
.inline-validation {
  margin-top: 0.25rem;
}

.inline-validation__error {
  font-size: 0.8125rem;
  color: #dc2626;
  margin: 0.125rem 0 0;
  line-height: 1.4;
}
</style>

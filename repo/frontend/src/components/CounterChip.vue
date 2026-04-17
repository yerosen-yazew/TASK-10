<script setup lang="ts">
// REQ: Shared UI primitive — inline numeric counter badge

import { computed } from 'vue'

const props = defineProps<{
  count: number
  max?: number
  label?: string
}>()

const isAtCap = computed(() => props.max !== undefined && props.count >= props.max)
const display = computed(() => {
  const n = props.max !== undefined && props.count > props.max ? `${props.max}+` : String(props.count)
  return props.label ? `${n} ${props.label}` : n
})
</script>

<template>
  <span class="counter-chip" :class="{ 'counter-chip--cap': isAtCap }">{{ display }}</span>
</template>

<style scoped>
.counter-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.4rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
  background: #e2e8f0;
  color: #475569;
}
.counter-chip--cap { background: #fee2e2; color: #b91c1c; }
</style>

<script setup lang="ts">
// REQ: R10 — Reusable horizontal tab filter strip for activity feed and similar lists

defineProps<{
  tabs: Array<{ key: string; label: string }>
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', key: string): void
}>()
</script>

<template>
  <div class="tab-filter" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      role="tab"
      class="tab-filter__tab"
      :class="{ 'tab-filter__tab--active': modelValue === tab.key }"
      :aria-selected="modelValue === tab.key"
      @click="emit('update:modelValue', tab.key)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped>
.tab-filter {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0;
}

.tab-filter__tab {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  color: #64748b;
  margin-bottom: -1px;
  border-radius: 2px 2px 0 0;
  transition: color 0.15s, border-color 0.15s;
}

.tab-filter__tab:hover { color: #1e293b; }

.tab-filter__tab--active {
  color: #2563eb;
  border-bottom-color: #2563eb;
  font-weight: 600;
}
</style>

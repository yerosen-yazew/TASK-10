<script setup lang="ts">
// REQ: Shared UI primitive — consistent empty-state block

defineProps<{
  icon?: string
  title: string
  description?: string
  actionLabel?: string
}>()

const emit = defineEmits<{
  (e: 'action'): void
}>()
</script>

<template>
  <div class="empty-state">
    <div v-if="icon" class="empty-state__icon" aria-hidden="true">{{ icon }}</div>
    <p class="empty-state__title">{{ title }}</p>
    <p v-if="description" class="empty-state__desc">{{ description }}</p>
    <button
      v-if="actionLabel"
      class="empty-state__action"
      @click="emit('action')"
    >{{ actionLabel }}</button>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  text-align: center;
  gap: 0.5rem;
}
.empty-state__icon { font-size: 2rem; opacity: 0.5; }
.empty-state__title { font-size: 0.9375rem; font-weight: 600; color: #334155; margin: 0; }
.empty-state__desc { font-size: 0.8125rem; color: #64748b; margin: 0; max-width: 20rem; }
.empty-state__action {
  margin-top: 0.5rem;
  padding: 0.375rem 0.875rem;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  cursor: pointer;
}
.empty-state__action:hover { background: #1d4ed8; }
</style>

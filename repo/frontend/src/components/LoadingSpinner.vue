<script setup lang="ts">
// REQ: Shared UI primitive — centered spinner for async states

defineProps<{
  size?: 'sm' | 'md' | 'lg'
}>()
</script>

<template>
  <div class="loading-spinner" :class="`loading-spinner--${size ?? 'md'}`" role="status" aria-label="Loading">
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-dasharray="60 20" />
    </svg>
  </div>
</template>

<style scoped>
.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
}
.loading-spinner svg {
  animation: spin 0.8s linear infinite;
}
.loading-spinner--sm svg { width: 1rem; height: 1rem; }
.loading-spinner--md svg { width: 1.5rem; height: 1.5rem; }
.loading-spinner--lg svg { width: 2.5rem; height: 2.5rem; }

@keyframes spin { to { transform: rotate(360deg); } }
</style>

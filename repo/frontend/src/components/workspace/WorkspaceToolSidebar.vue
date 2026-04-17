<script setup lang="ts">
// REQ: R5 — Left tool palette for whiteboard element creation

import type { ToolType } from '@/stores/preferences-store'

const props = defineProps<{
  activeTool: ToolType
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'tool-selected', tool: ToolType): void
}>()

const tools: Array<{ key: ToolType; icon: string; label: string }> = [
  { key: 'select', icon: '↖', label: 'Select (V)' },
  { key: 'sticky', icon: '□', label: 'Sticky Note (S)' },
  { key: 'arrow', icon: '→', label: 'Arrow (A)' },
  { key: 'pen', icon: '✏', label: 'Pen (P)' },
  { key: 'image', icon: '🖼', label: 'Image (I)' },
]
</script>

<template>
  <nav class="tool-sidebar" aria-label="Drawing tools">
    <button
      v-for="tool in tools"
      :key="tool.key"
      class="tool-sidebar__btn"
      :class="{ 'tool-sidebar__btn--active': activeTool === tool.key }"
      :title="tool.label"
      :disabled="disabled && tool.key !== 'select'"
      :aria-pressed="activeTool === tool.key"
      @click="emit('tool-selected', tool.key)"
    >
      <span aria-hidden="true">{{ tool.icon }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tool-sidebar {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 0;
  gap: 0.25rem;
  width: 100%;
}

.tool-sidebar__btn {
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  color: #94a3b8;
  font-size: 1rem;
  transition: all 0.1s;
}
.tool-sidebar__btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.1);
  color: #e2e8f0;
}
.tool-sidebar__btn--active {
  background: #3b82f6;
  border-color: #2563eb;
  color: #fff;
}
.tool-sidebar__btn:disabled { opacity: 0.35; cursor: not-allowed; }
</style>

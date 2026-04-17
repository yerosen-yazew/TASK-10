<script setup lang="ts">
// REQ: R16 — Autosave indicator: saved / saving / failed / idle states

defineProps<{
  status: 'idle' | 'saving' | 'saved' | 'failed'
  lastSavedAt?: string | null
}>()

function formatTime(iso?: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}
</script>

<template>
  <div
    class="autosave"
    :class="`autosave--${status}`"
    :title="status === 'saved' && lastSavedAt ? `Last saved at ${formatTime(lastSavedAt)}` : undefined"
  >
    <span v-if="status === 'saving'" class="autosave__dot autosave__dot--pulse" />
    <span v-else class="autosave__dot" />
    <span class="autosave__label">
      <template v-if="status === 'saving'">Saving…</template>
      <template v-else-if="status === 'saved'">Saved{{ lastSavedAt ? ` ${formatTime(lastSavedAt)}` : '' }}</template>
      <template v-else-if="status === 'failed'">Save failed</template>
      <template v-else>Unsaved</template>
    </span>
  </div>
</template>

<style scoped>
.autosave {
  display: flex;
  align-items: center;
  gap: 0.3125rem;
  font-size: 0.6875rem;
  color: #64748b;
  flex-shrink: 0;
}

.autosave__dot {
  width: 0.4375rem;
  height: 0.4375rem;
  border-radius: 50%;
  background: #cbd5e1;
  flex-shrink: 0;
}

.autosave--saving .autosave__dot { background: #f59e0b; }
.autosave--saved .autosave__dot { background: #22c55e; }
.autosave--failed .autosave__dot { background: #ef4444; }

.autosave--saving .autosave__label { color: #92400e; }
.autosave--saved .autosave__label { color: #15803d; }
.autosave--failed .autosave__label { color: #b91c1c; }

.autosave__dot--pulse {
  animation: autosave-pulse 1s ease-in-out infinite;
}

@keyframes autosave-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>

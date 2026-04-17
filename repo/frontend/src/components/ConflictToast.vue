<script setup lang="ts">
// REQ: R18 — Conflict notification toast with overwrite/discard choice

defineProps<{
  message: string
  conflictType: 'element-overwrite' | 'pin-collision' | 'membership-race' | 'rollback-collision'
}>()

const emit = defineEmits<{
  (e: 'overwrite'): void
  (e: 'discard'): void
  (e: 'dismiss'): void
}>()
</script>

<template>
  <div class="conflict-toast" role="alert">
    <span class="conflict-toast__icon" aria-hidden="true">⚠</span>
    <div class="conflict-toast__body">
      <p class="conflict-toast__message">{{ message }}</p>
      <div class="conflict-toast__actions">
        <button class="conflict-toast__btn conflict-toast__btn--overwrite" @click="emit('overwrite')">
          Keep Mine
        </button>
        <button class="conflict-toast__btn conflict-toast__btn--discard" @click="emit('discard')">
          Discard Mine
        </button>
      </div>
    </div>
    <button class="conflict-toast__close" aria-label="Dismiss" @click="emit('dismiss')">×</button>
  </div>
</template>

<style scoped>
.conflict-toast {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.75rem;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  max-width: 22rem;
}
.conflict-toast__icon { font-size: 1rem; color: #ea580c; flex-shrink: 0; margin-top: 1px; }
.conflict-toast__body { flex: 1; }
.conflict-toast__message { margin: 0 0 0.5rem; font-size: 0.8125rem; color: #1e293b; }
.conflict-toast__actions { display: flex; gap: 0.5rem; }
.conflict-toast__btn {
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}
.conflict-toast__btn--overwrite { background: #ea580c; color: #fff; }
.conflict-toast__btn--overwrite:hover { background: #c2410c; }
.conflict-toast__btn--discard { background: #f1f5f9; color: #334155; }
.conflict-toast__btn--discard:hover { background: #e2e8f0; }
.conflict-toast__close {
  background: none; border: none; cursor: pointer; color: #94a3b8;
  font-size: 1.125rem; line-height: 1; padding: 0; flex-shrink: 0;
}
</style>

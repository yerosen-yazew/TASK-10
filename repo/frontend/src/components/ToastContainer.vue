<script setup lang="ts">
// REQ: Shared feedback primitive — transient toast notifications
import { useUiStore } from '@/stores/ui-store'

const uiStore = useUiStore()
</script>

<template>
  <div class="toast-container" role="region" aria-label="Notifications" aria-live="polite">
    <transition-group name="toast" tag="div" class="toast-list">
      <div
        v-for="toast in uiStore.toasts"
        :key="toast.id"
        class="toast"
        :class="`toast--${toast.type}`"
        role="alert"
      >
        <span class="toast__message">{{ toast.message }}</span>
        <button
          class="toast__close"
          aria-label="Dismiss notification"
          @click="uiStore.removeToast(toast.id)"
        >
          ×
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 20rem;
  pointer-events: none;
}

.toast-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  line-height: 1.4;
  pointer-events: all;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  color: #fff;
}

.toast--info    { background: #2563eb; }
.toast--success { background: #16a34a; }
.toast--warning { background: #d97706; }
.toast--error   { background: #dc2626; }

.toast__message { flex: 1; }

.toast__close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1.125rem;
  line-height: 1;
  opacity: 0.8;
  padding: 0;
}
.toast__close:hover { opacity: 1; }

.toast-enter-active,
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from  { opacity: 0; transform: translateX(1rem); }
.toast-leave-to    { opacity: 0; transform: translateX(1rem); }
</style>

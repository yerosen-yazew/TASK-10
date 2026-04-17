<script setup lang="ts">
// REQ: Shared feedback primitive — modal confirmation dialogs (rollback, delete, sign-out)
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui-store'

const uiStore = useUiStore()

const isOpen = computed(() => uiStore.pendingConfirm !== null)
const options = computed(() => uiStore.pendingConfirm?.options)

function handleConfirm() {
  uiStore.resolveConfirm(true)
}

function handleCancel() {
  uiStore.resolveConfirm(false)
}

function handleOverlayClick(event: MouseEvent) {
  // Only dismiss when clicking directly on the overlay, not its children
  if (event.target === event.currentTarget) {
    handleCancel()
  }
}
</script>

<template>
  <teleport to="body">
    <div
      v-if="isOpen"
      class="modal-overlay"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="options?.title ? 'confirm-modal-title' : undefined"
      @click="handleOverlayClick"
    >
      <div class="modal-dialog">
        <h2 v-if="options?.title" id="confirm-modal-title" class="modal-title">
          {{ options.title }}
        </h2>
        <p class="modal-message">{{ options?.message }}</p>
        <div class="modal-actions">
          <button
            class="modal-btn modal-btn--cancel"
            @click="handleCancel"
          >
            {{ options?.cancelLabel ?? 'Cancel' }}
          </button>
          <button
            class="modal-btn"
            :class="options?.danger ? 'modal-btn--danger' : 'modal-btn--confirm'"
            @click="handleConfirm"
          >
            {{ options?.confirmLabel ?? 'Confirm' }}
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9500;
  padding: 1rem;
}

.modal-dialog {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  max-width: 28rem;
  width: 100%;
  padding: 1.5rem;
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
  color: #111;
}

.modal-message {
  font-size: 0.9375rem;
  color: #374151;
  margin: 0 0 1.25rem;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
}

.modal-btn {
  padding: 0.5rem 1.125rem;
  border-radius: 5px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
}

.modal-btn--cancel {
  background: #f3f4f6;
  border-color: #d1d5db;
  color: #374151;
}
.modal-btn--cancel:hover { background: #e5e7eb; }

.modal-btn--confirm {
  background: #2563eb;
  color: #fff;
}
.modal-btn--confirm:hover { background: #1d4ed8; }

.modal-btn--danger {
  background: #dc2626;
  color: #fff;
}
.modal-btn--danger:hover { background: #b91c1c; }
</style>

<script setup lang="ts">
// REQ: R17 — Snapshot timeline with one-click rollback, trigger labels, post-rollback summary

import { onMounted } from 'vue'
import { useSnapshotStore } from '@/stores/snapshot-store'
import { useSessionStore } from '@/stores/session-store'
import type { ActivityActor } from '@/engine/activity-engine'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'

const props = defineProps<{
  roomId: string
  isHost?: boolean
}>()

const snapshotStore = useSnapshotStore()
const sessionStore = useSessionStore()

function buildActor(): ActivityActor {
  return {
    memberId: sessionStore.activeProfileId ?? 'unknown',
    displayName: sessionStore.activeProfile?.displayName ?? 'Unknown',
  }
}

async function rollback(snapshotId: string): Promise<void> {
  await snapshotStore.rollback(props.roomId, snapshotId, buildActor())
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

onMounted(() => snapshotStore.refresh(props.roomId))
</script>

<template>
  <div class="snapshot-drawer">
    <div class="snapshot-drawer__header">
      <span class="snapshot-drawer__title">Snapshots ({{ snapshotStore.snapshots.length }})</span>
    </div>

    <LoadingSpinner v-if="snapshotStore.isLoading" size="sm" />

    <EmptyState
      v-else-if="!snapshotStore.isLoading && snapshotStore.snapshots.length === 0"
      title="No snapshots yet"
      description="Snapshots are created automatically every 5 minutes."
    />

    <!-- Post-rollback summary -->
    <div v-if="snapshotStore.lastRollback" class="snapshot-drawer__rollback-summary" data-testid="rollback-summary">
      <p class="snapshot-drawer__rollback-msg">
        ✓ Rolled back to #{{ snapshotStore.lastRollback.sourceSequenceNumber }}
        by {{ snapshotStore.lastRollback.initiatorDisplayName }}.
        A new recovery snapshot was created.
      </p>
      <button class="snapshot-drawer__rollback-dismiss" @click="snapshotStore.lastRollback = null">
        Dismiss
      </button>
    </div>

    <ul v-if="snapshotStore.snapshots.length > 0" class="snapshot-drawer__list">
      <li
        v-for="snap in snapshotStore.snapshots.slice().reverse()"
        :key="snap.snapshotId"
        class="snapshot-drawer__item"
        :data-testid="`snapshot-item-${snap.snapshotId}`"
      >
        <div class="snapshot-drawer__info">
          <span class="snapshot-drawer__seq">#{{ snap.sequenceNumber }}</span>
          <span class="snapshot-drawer__time">{{ formatDate(snap.createdAt) }}</span>
          <span class="snapshot-drawer__size">{{ formatSize(snap.sizeBytes) }}</span>
        </div>
        <button
          v-if="isHost"
          class="snapshot-drawer__rollback"
          :disabled="snapshotStore.isRollingBack"
          :data-testid="`rollback-btn-${snap.snapshotId}`"
          title="Roll back to this snapshot"
          @click="rollback(snap.snapshotId)"
        >
          Restore
        </button>
      </li>
    </ul>

    <p v-if="snapshotStore.lastError" class="snapshot-drawer__error" data-testid="snapshot-error">
      {{ snapshotStore.lastError }}
    </p>
  </div>
</template>

<style scoped>
.snapshot-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.snapshot-drawer__header {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.snapshot-drawer__title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #1e293b;
}

.snapshot-drawer__list {
  list-style: none;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  flex: 1;
}

.snapshot-drawer__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
}

.snapshot-drawer__rollback-summary {
  padding: 0.5rem 0.75rem;
  background: #f0fdf4;
  border-bottom: 1px solid #bbf7d0;
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.snapshot-drawer__rollback-msg {
  font-size: 0.75rem;
  color: #15803d;
  margin: 0;
  flex: 1;
}

.snapshot-drawer__rollback-dismiss {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.6875rem;
  color: #15803d;
  padding: 0;
  flex-shrink: 0;
  text-decoration: underline;
}

.snapshot-drawer__info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.snapshot-drawer__info-top {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.snapshot-drawer__trigger {
  font-size: 0.5625rem;
  font-weight: 600;
  padding: 0.0625rem 0.25rem;
  border-radius: 2px;
  text-transform: uppercase;
}
.snapshot-drawer__trigger--auto { background: #dbeafe; color: #1d4ed8; }
.snapshot-drawer__trigger--manual { background: #ede9fe; color: #7c3aed; }
.snapshot-drawer__trigger--rollback { background: #fef9c3; color: #854d0e; }

.snapshot-drawer__seq {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #475569;
}

.snapshot-drawer__time {
  font-size: 0.75rem;
  color: #1e293b;
}

.snapshot-drawer__size {
  font-size: 0.6875rem;
  color: #94a3b8;
}

.snapshot-drawer__rollback {
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  cursor: pointer;
  color: #1e293b;
  flex-shrink: 0;
}
.snapshot-drawer__rollback:hover:not(:disabled) { background: #e2e8f0; }
.snapshot-drawer__rollback:disabled { opacity: 0.4; cursor: not-allowed; }

.snapshot-drawer__error {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  color: #dc2626;
}
</style>

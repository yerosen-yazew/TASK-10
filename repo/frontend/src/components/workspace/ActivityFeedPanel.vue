<script setup lang="ts">
// REQ: R10 — Activity feed panel with filter tabs

import { onMounted, onUnmounted, computed, watch } from 'vue'
import { useActivityStore } from '@/stores/activity-store'
import { ActivityFilter } from '@/models/activity'
import TabFilter from '@/components/TabFilter.vue'
import EmptyState from '@/components/EmptyState.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'

const props = defineProps<{
  roomId: string
}>()

const activityStore = useActivityStore()

const filterTabs = [
  { key: ActivityFilter.All, label: 'All' },
  { key: ActivityFilter.Elements, label: 'Elements' },
  { key: ActivityFilter.Comments, label: 'Comments' },
  { key: ActivityFilter.Pins, label: 'Pins' },
  { key: ActivityFilter.Rollbacks, label: 'Rollbacks' },
  { key: ActivityFilter.Membership, label: 'Members' },
]

const activeFilter = computed({
  get: () => activityStore.filter,
  set: (v: ActivityFilter) => {
    activityStore.setFilter(v)
    activityStore.refresh(props.roomId)
  },
})

const borderColor: Record<string, string> = {
  element_created: '#22c55e',
  element_updated: '#3b82f6',
  element_deleted: '#ef4444',
  comment_added: '#8b5cf6',
  comment_edited: '#8b5cf6',
  comment_deleted: '#8b5cf6',
  message_pinned: '#f97316',
  message_unpinned: '#f97316',
  snapshot_rolled_back: '#ef4444',
  member_joined: '#22c55e',
  member_left: '#94a3b8',
  member_approved: '#22c55e',
  member_rejected: '#ef4444',
  room_created: '#2563eb',
}

function eventBorderColor(type: string): string {
  return borderColor[type] ?? '#e2e8f0'
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

let refreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await activityStore.refresh(props.roomId)
  refreshTimer = setInterval(() => activityStore.refresh(props.roomId), 30_000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

watch(
  () => props.roomId,
  async (id) => { await activityStore.refresh(id) }
)
</script>

<template>
  <div class="activity-feed">
    <!-- Filter tabs -->
    <div class="activity-feed__tabs">
      <TabFilter :tabs="filterTabs" v-model="activeFilter" />
    </div>

    <!-- Loading -->
    <div v-if="activityStore.isLoading" class="activity-feed__loading">
      <LoadingSpinner size="sm" />
    </div>

    <!-- Error -->
    <p v-else-if="activityStore.lastError" class="activity-feed__error">
      {{ activityStore.lastError }}
    </p>

    <!-- Empty -->
    <EmptyState
      v-else-if="activityStore.filteredEvents.length === 0"
      title="No activity yet"
      description="Actions in this room will appear here."
    />

    <!-- Events list -->
    <ul v-else class="activity-feed__list">
      <li
        v-for="event in activityStore.filteredEvents"
        :key="event.eventId"
        class="activity-feed__item"
        :style="{ borderLeftColor: eventBorderColor(event.type) }"
      >
        <div
          class="activity-feed__actor-avatar"
          :style="{ background: '#6366f1' }"
        >
          {{ event.actorDisplayName.charAt(0).toUpperCase() }}
        </div>
        <div class="activity-feed__content">
          <p class="activity-feed__summary">{{ event.summary }}</p>
          <span class="activity-feed__time">{{ formatTime(event.createdAt) }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.activity-feed {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.activity-feed__tabs {
  padding: 0 0.5rem;
  flex-shrink: 0;
}

.activity-feed__loading {
  display: flex;
  justify-content: center;
  padding: 1.5rem;
}

.activity-feed__error {
  padding: 0.75rem;
  font-size: 0.8125rem;
  color: #dc2626;
}

.activity-feed__list {
  list-style: none;
  margin: 0;
  padding: 0.25rem 0;
  overflow-y: auto;
  flex: 1;
}

.activity-feed__item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid #e2e8f0;
  border-bottom: 1px solid #f1f5f9;
}

.activity-feed__actor-avatar {
  width: 1.375rem;
  height: 1.375rem;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  font-weight: 700;
  color: #fff;
}

.activity-feed__content { flex: 1; }
.activity-feed__summary {
  margin: 0;
  font-size: 0.8125rem;
  color: #1e293b;
  line-height: 1.35;
}
.activity-feed__time {
  font-size: 0.6875rem;
  color: #94a3b8;
}
</style>

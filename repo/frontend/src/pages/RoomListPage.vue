<script setup lang="ts">
// REQ: R1/R2 — Room list with recent rooms, create/join entry points

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { listRooms } from '@/engine/room-engine'
import { useSessionStore } from '@/stores/session-store'
import { useUiStore } from '@/stores/ui-store'
import { LS_KEYS, lsGetJSON, type RecentRoomEntry } from '@/services/local-storage-keys'
import { memberRepository } from '@/services/member-repository'
import type { Room } from '@/models/room'
import AppLayout from '@/layouts/AppLayout.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'

const router = useRouter()
const sessionStore = useSessionStore()
const uiStore = useUiStore()

const rooms = ref<Room[]>([])
const isLoading = ref(false)
const lastError = ref<string | null>(null)
const memberCounts = ref<Record<string, number>>({})

const recentRooms = computed<RecentRoomEntry[]>(
  () => lsGetJSON<RecentRoomEntry[]>(LS_KEYS.RECENT_ROOMS) ?? []
)

const recentRoomIds = computed(() => new Set(recentRooms.value.map((r) => r.roomId)))

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return '' }
}

onMounted(async () => {
  isLoading.value = true
  lastError.value = null
  try {
    rooms.value = await listRooms()
    // Load active member counts
    for (const room of rooms.value) {
      memberCounts.value[room.roomId] = await memberRepository.countActiveByRoom(room.roomId)
    }
  } catch (err) {
    lastError.value = 'Failed to load rooms.'
    uiStore.toast.error('Failed to load rooms.')
  } finally {
    isLoading.value = false
  }
})

function openRoom(roomId: string): void {
  router.push({ name: 'workspace', params: { roomId } })
}

function buildJoinLink(pairingCode: string): string {
  const origin =
    typeof window !== 'undefined' && window.location
      ? window.location.origin
      : ''
  return `${origin}/rooms/join?code=${encodeURIComponent(pairingCode)}`
}

async function copyJoinLink(pairingCode: string): Promise<void> {
  const url = buildJoinLink(pairingCode)
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      uiStore.toast.success('Link copied.')
      return
    }
  } catch {
    // Fall through to manual fallback.
  }
  if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
    window.prompt('Copy this link:', url)
  }
}
</script>

<template>
  <AppLayout>
    <div class="room-list-page">
      <div class="room-list-page__header">
        <h1 class="room-list-page__title">My Rooms</h1>
        <div class="room-list-page__actions">
          <router-link to="/rooms/join" class="room-list-page__btn room-list-page__btn--secondary">
            Join Room
          </router-link>
          <router-link to="/rooms/create" class="room-list-page__btn room-list-page__btn--primary">
            Create Room
          </router-link>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="room-list-page__loading">
        <LoadingSpinner size="md" />
      </div>

      <!-- Error -->
      <div v-else-if="lastError" class="room-list-page__error">
        {{ lastError }}
      </div>

      <template v-else>
        <!-- Recent rooms section -->
        <section v-if="recentRooms.length > 0" class="room-list-page__section">
          <h2 class="room-list-page__section-heading">Recently Accessed</h2>
          <div class="room-list-page__grid">
            <button
              v-for="recent in recentRooms"
              :key="recent.roomId"
              class="room-list-page__card room-list-page__card--recent"
              @click="openRoom(recent.roomId)"
            >
              <span class="room-list-page__card-name">{{ recent.name }}</span>
              <span class="room-list-page__card-meta">{{ formatDate(recent.lastAccessed) }}</span>
            </button>
          </div>
        </section>

        <!-- All rooms -->
        <section class="room-list-page__section">
          <h2 class="room-list-page__section-heading">All Rooms</h2>

          <EmptyState
            v-if="rooms.length === 0"
            icon="🏠"
            title="No rooms yet"
            description="Create your first room or join an existing one using a pairing code."
            action-label="Create Room"
            @action="router.push({ name: 'room-create' })"
          />

          <div v-else class="room-list-page__grid">
            <button
              v-for="room in rooms"
              :key="room.roomId"
              class="room-list-page__card"
              :class="{ 'room-list-page__card--recent-highlight': recentRoomIds.has(room.roomId) }"
              @click="openRoom(room.roomId)"
            >
              <div class="room-list-page__card-header">
                <span class="room-list-page__card-name">{{ room.name }}</span>
                <span class="room-list-page__card-code" title="Pairing code">{{ room.pairingCode }}</span>
                <button
                  type="button"
                  class="room-list-page__copy-btn"
                  :data-testid="`copy-link-${room.roomId}`"
                  title="Copy join link"
                  @click.stop="copyJoinLink(room.pairingCode)"
                >
                  🔗 Copy Link
                </button>
              </div>
              <p v-if="room.description" class="room-list-page__card-desc">{{ room.description }}</p>
              <div class="room-list-page__card-footer">
                <span class="room-list-page__card-members">
                  👥 {{ memberCounts[room.roomId] ?? 0 }} active
                </span>
                <span class="room-list-page__card-date">
                  Created {{ formatDate(room.createdAt) }}
                </span>
              </div>
            </button>
          </div>
        </section>
      </template>
    </div>
  </AppLayout>
</template>

<style scoped>
.room-list-page {
  padding: 1.5rem 2rem;
  max-width: 64rem;
  margin: 0 auto;
  width: 100%;
}

.room-list-page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.room-list-page__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.room-list-page__actions { display: flex; gap: 0.75rem; }

.room-list-page__btn {
  padding: 0.5rem 1rem;
  font-size: 0.9375rem;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
}
.room-list-page__btn--primary { background: #2563eb; color: #fff; border: none; font-weight: 600; }
.room-list-page__btn--primary:hover { background: #1d4ed8; }
.room-list-page__btn--secondary { background: #fff; color: #334155; border: 1px solid #e2e8f0; }
.room-list-page__btn--secondary:hover { background: #f1f5f9; }

.room-list-page__loading {
  display: flex;
  justify-content: center;
  padding: 4rem;
}

.room-list-page__error {
  padding: 1rem;
  background: #fee2e2;
  border-radius: 6px;
  color: #b91c1c;
  font-size: 0.875rem;
}

.room-list-page__section { margin-bottom: 2rem; }

.room-list-page__section-heading {
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  margin: 0 0 0.75rem;
}

.room-list-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.75rem;
}

.room-list-page__card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
.room-list-page__card:hover {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
}
.room-list-page__card--recent { background: #f0f9ff; }
.room-list-page__card--recent-highlight { border-color: #93c5fd; }

.room-list-page__card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.room-list-page__card-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-list-page__card-code {
  font-size: 0.6875rem;
  font-family: monospace;
  background: #f1f5f9;
  color: #475569;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  flex-shrink: 0;
}

.room-list-page__card-desc {
  font-size: 0.8125rem;
  color: #64748b;
  margin: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.room-list-page__card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.25rem;
}

.room-list-page__card-members { font-size: 0.75rem; color: #64748b; }
.room-list-page__card-date { font-size: 0.6875rem; color: #94a3b8; }

.room-list-page__card-meta { font-size: 0.75rem; color: #64748b; }

.room-list-page__copy-btn {
  font-size: 0.6875rem;
  padding: 0.125rem 0.375rem;
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  color: #2563eb;
  flex-shrink: 0;
}
.room-list-page__copy-btn:hover { background: #eff6ff; }
</style>

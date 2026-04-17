<script setup lang="ts">
// REQ: Application shell layout — wraps page content with header, banners, toasts, and modals
// REQ: R11 — Roles are UI personas only; role info shown in header without implying security
import { computed } from 'vue'
import { useSessionStore } from '@/stores/session-store'
import { useUiStore } from '@/stores/ui-store'
import { RoomRole } from '@/models/room'
import AppBanner from '@/components/AppBanner.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'

interface Props {
  /** Optional current role for display in the header (UI persona only). */
  role?: RoomRole | null
}

const props = withDefaults(defineProps<Props>(), {
  role: null,
})

const sessionStore = useSessionStore()
const uiStore = useUiStore()

const profileInitial = computed(() => {
  const name = sessionStore.activeProfile?.displayName ?? ''
  return name.charAt(0).toUpperCase() || '?'
})

const avatarStyle = computed(() => ({
  background: sessionStore.activeProfile?.avatarColor ?? '#9ca3af',
}))

const roleLabel = computed(() => {
  if (!props.role) return null
  const labels: Record<RoomRole, string> = {
    [RoomRole.Host]: 'Host',
    [RoomRole.Reviewer]: 'Reviewer',
    [RoomRole.Participant]: 'Participant',
    [RoomRole.Guest]: 'Guest',
  }
  return labels[props.role] ?? null
})

function handleLock() {
  sessionStore.lock()
}
</script>

<template>
  <div class="app-layout">
    <!-- Persistent banners (conflict notices, session warnings) -->
    <AppBanner />

    <!-- Header -->
    <header class="app-header">
      <div class="app-header__left">
        <router-link to="/" class="app-logo">ForgeRoom</router-link>
      </div>

      <div v-if="sessionStore.isUnlocked" class="app-header__right">
        <!-- Role badge (UI persona only — not a security boundary) -->
        <span
          v-if="roleLabel"
          class="app-header__role"
          title="Roles are UI personas only and are not a security boundary"
        >
          {{ roleLabel }}
        </span>

        <!-- Profile chip -->
        <div class="app-header__profile">
          <span class="app-header__avatar" :style="avatarStyle" aria-hidden="true">
            {{ profileInitial }}
          </span>
          <span class="app-header__profile-name">
            {{ sessionStore.activeProfile?.displayName }}
          </span>
        </div>

        <!-- Lock button -->
        <button class="app-header__lock-btn" title="Lock session" @click="handleLock">
          Lock
        </button>
      </div>
    </header>

    <!-- Main content -->
    <main class="app-main">
      <slot />
    </main>

    <!-- Global toast stack -->
    <ToastContainer />

    <!-- Global confirmation modal -->
    <ConfirmModal />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  height: 3rem;
  background: #1e293b;
  color: #e2e8f0;
  flex-shrink: 0;
}

.app-header__left { display: flex; align-items: center; }
.app-header__right { display: flex; align-items: center; gap: 0.75rem; }

.app-logo {
  color: #f8fafc;
  text-decoration: none;
  font-weight: 700;
  font-size: 1.0625rem;
  letter-spacing: -0.01em;
}
.app-logo:hover { color: #7dd3fc; }

.app-header__role {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  background: #334155;
  border-radius: 999px;
  color: #94a3b8;
}

.app-header__profile {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.app-header__avatar {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.75rem;
  color: #fff;
  flex-shrink: 0;
}

.app-header__profile-name {
  font-size: 0.875rem;
  color: #cbd5e1;
  max-width: 8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-header__lock-btn {
  padding: 0.25rem 0.625rem;
  font-size: 0.8125rem;
  background: #334155;
  border: 1px solid #475569;
  border-radius: 4px;
  color: #e2e8f0;
  cursor: pointer;
}
.app-header__lock-btn:hover { background: #475569; }

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>

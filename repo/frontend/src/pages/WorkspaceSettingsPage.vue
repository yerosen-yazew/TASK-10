<script setup lang="ts">
// REQ: R1/R15 — Workspace settings: approval toggles (Host only) + theme/avatar preferences

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room-store'
import { useSessionStore } from '@/stores/session-store'
import { useUiStore } from '@/stores/ui-store'
import { usePreferencesStore } from '@/stores/preferences-store'
import { updateRoomSettings } from '@/engine/room-engine'
import { RoomRole } from '@/models/room'
import { LS_KEYS, lsSetString } from '@/services/local-storage-keys'
import AppLayout from '@/layouts/AppLayout.vue'

const AVATAR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#64748b', '#0f172a',
]

const props = defineProps<{
  roomId: string
}>()

const router = useRouter()
const roomStore = useRoomStore()
const sessionStore = useSessionStore()
const uiStore = useUiStore()
const preferencesStore = usePreferencesStore()

const requireApproval = ref(true)
const enableSecondReviewer = ref(false)
const isSaving = ref(false)
const selectedTheme = ref(preferencesStore.theme)
const selectedAvatarColor = ref(
  sessionStore.activeProfile?.avatarColor ?? AVATAR_COLORS[0]
)

const isHost = computed(() => {
  if (!sessionStore.activeProfileId) return false
  const member = roomStore.members.find((m) => m.memberId === sessionStore.activeProfileId)
  return member?.role === RoomRole.Host
})

onMounted(async () => {
  if (!roomStore.activeRoom) {
    await roomStore.loadRoom(props.roomId)
  }
  if (roomStore.activeRoom) {
    requireApproval.value = roomStore.activeRoom.settings.requireApproval
    enableSecondReviewer.value = roomStore.activeRoom.settings.enableSecondReviewer
  }
})

function savePreferences(): void {
  preferencesStore.setTheme(selectedTheme.value)
  lsSetString(LS_KEYS.AVATAR_COLOR, selectedAvatarColor.value)
  uiStore.toast.success('Preferences saved.')
}

async function save(): Promise<void> {
  if (!isHost.value) return
  isSaving.value = true
  try {
    await updateRoomSettings(props.roomId, {
      requireApproval: requireApproval.value,
      enableSecondReviewer: enableSecondReviewer.value,
    })
    await roomStore.loadRoom(props.roomId)
    uiStore.toast.success('Settings saved.')
    await router.push({ name: 'workspace', params: { roomId: props.roomId } })
  } catch {
    uiStore.toast.error('Failed to save settings.')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <AppLayout>
    <div class="ws-settings-page">
      <div class="ws-settings-page__card">
        <h1 class="ws-settings-page__title">Room Settings</h1>

        <div v-if="roomStore.isLoading" class="ws-settings-page__loading">Loading…</div>

        <template v-else-if="roomStore.activeRoom">
          <p class="ws-settings-page__room-name">{{ roomStore.activeRoom.name }}</p>

          <div v-if="!isHost" class="ws-settings-page__no-access">
            Only the Host can change room settings.
          </div>

          <form v-else class="ws-settings-page__form" @submit.prevent="save">
            <label class="ws-settings-page__checkbox-label">
              <input v-model="requireApproval" type="checkbox" :disabled="isSaving" />
              Require approval to join
            </label>
            <label
              class="ws-settings-page__checkbox-label"
              :class="{ 'ws-settings-page__checkbox-label--disabled': !requireApproval }"
            >
              <input
                v-model="enableSecondReviewer"
                type="checkbox"
                :disabled="isSaving || !requireApproval"
              />
              Require second Reviewer approval at 15+ members
            </label>

            <div class="ws-settings-page__actions">
              <router-link :to="`/workspace/${roomId}`" class="ws-settings-page__cancel">Cancel</router-link>
              <button type="submit" class="ws-settings-page__submit" :disabled="isSaving">
                {{ isSaving ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </form>

          <!-- Preferences (available to all members) -->
          <div class="ws-settings-page__divider" />
          <h2 class="ws-settings-page__section-title">Preferences</h2>

          <div class="ws-settings-page__pref-row">
            <label class="ws-settings-page__pref-label" for="theme-select">Theme</label>
            <select
              id="theme-select"
              v-model="selectedTheme"
              class="ws-settings-page__select"
              data-testid="theme-select"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div class="ws-settings-page__pref-row">
            <span class="ws-settings-page__pref-label">Avatar Color</span>
            <div class="ws-settings-page__color-grid" data-testid="avatar-color-grid">
              <button
                v-for="color in AVATAR_COLORS"
                :key="color"
                type="button"
                class="ws-settings-page__color-swatch"
                :class="{ 'ws-settings-page__color-swatch--selected': selectedAvatarColor === color }"
                :style="{ background: color }"
                :title="color"
                :data-testid="`color-swatch-${color}`"
                @click="selectedAvatarColor = color"
              />
            </div>
          </div>

          <button
            type="button"
            class="ws-settings-page__submit"
            style="align-self: flex-start"
            data-testid="save-prefs-btn"
            @click="savePreferences"
          >
            Save Preferences
          </button>
        </template>

        <div v-else class="ws-settings-page__no-access">Room not found.</div>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.ws-settings-page {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 3rem 1rem;
  min-height: 100%;
}
.ws-settings-page__card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 2rem;
  width: 100%;
  max-width: 24rem;
}
.ws-settings-page__title {
  font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0 0 0.5rem;
}
.ws-settings-page__room-name { font-size: 0.875rem; color: #64748b; margin: 0 0 1.25rem; }
.ws-settings-page__loading { color: #64748b; font-size: 0.875rem; }
.ws-settings-page__no-access { font-size: 0.875rem; color: #64748b; }
.ws-settings-page__form { display: flex; flex-direction: column; gap: 0.75rem; }
.ws-settings-page__checkbox-label {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.875rem; color: #334155; cursor: pointer;
}
.ws-settings-page__checkbox-label--disabled { opacity: 0.5; cursor: not-allowed; }
.ws-settings-page__actions {
  display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;
}
.ws-settings-page__cancel {
  padding: 0.5rem 1rem; font-size: 0.875rem; color: #64748b;
  text-decoration: none; border: 1px solid #e2e8f0; border-radius: 6px;
}
.ws-settings-page__submit {
  padding: 0.5rem 1.25rem; font-size: 0.9375rem;
  background: #2563eb; color: #fff; border: none; border-radius: 6px;
  cursor: pointer; font-weight: 600;
}
.ws-settings-page__submit:disabled { opacity: 0.5; cursor: not-allowed; }

.ws-settings-page__divider { border: none; border-top: 1px solid #e2e8f0; margin: 0.25rem 0; }
.ws-settings-page__section-title { font-size: 0.9375rem; font-weight: 600; color: #1e293b; margin: 0.5rem 0 0; }
.ws-settings-page__pref-row { display: flex; align-items: center; gap: 0.75rem; }
.ws-settings-page__pref-label { font-size: 0.875rem; color: #334155; min-width: 6rem; flex-shrink: 0; }
.ws-settings-page__select {
  font-size: 0.875rem; border: 1px solid #e2e8f0; border-radius: 6px;
  padding: 0.25rem 0.5rem; color: #334155; background: #fff;
}
.ws-settings-page__color-grid { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.ws-settings-page__color-swatch {
  width: 1.5rem; height: 1.5rem; border-radius: 50%;
  border: 2px solid transparent; cursor: pointer; padding: 0;
}
.ws-settings-page__color-swatch--selected { border-color: #1e293b; }
</style>

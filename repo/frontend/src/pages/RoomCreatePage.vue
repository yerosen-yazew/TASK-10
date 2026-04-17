<script setup lang="ts">
// REQ: R1 — Room creation form: name, description, approval settings
// REQ: R2 — Generates pairing code on creation

import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room-store'
import { useSessionStore } from '@/stores/session-store'
import { useUiStore } from '@/stores/ui-store'
import { validateRoomCreatePayload } from '@/validators/room-create-validator'
import { LS_KEYS, lsGetJSON, lsSetJSON, type RecentRoomEntry } from '@/services/local-storage-keys'
import AppLayout from '@/layouts/AppLayout.vue'
import InlineValidation from '@/components/InlineValidation.vue'
import type { FieldError } from '@/models/validation'

const router = useRouter()
const roomStore = useRoomStore()
const sessionStore = useSessionStore()
const uiStore = useUiStore()

const name = ref('')
const description = ref('')
const requireApproval = ref(true)
const enableSecondReviewer = ref(false)
const errors = ref<FieldError[]>([])
const isSubmitting = ref(false)

const nameErrors = computed(() => errors.value.filter((e) => e.field === 'name'))
const descriptionErrors = computed(() => errors.value.filter((e) => e.field === 'description'))

function addToRecentRooms(roomId: string, roomName: string): void {
  const existing = lsGetJSON<RecentRoomEntry[]>(LS_KEYS.RECENT_ROOMS) ?? []
  const entry: RecentRoomEntry = { roomId, name: roomName, lastAccessed: new Date().toISOString() }
  const updated = [entry, ...existing.filter((r) => r.roomId !== roomId)].slice(0, 10)
  lsSetJSON(LS_KEYS.RECENT_ROOMS, updated)
}

async function submit(): Promise<void> {
  errors.value = []
  const validation = validateRoomCreatePayload({
    name: name.value,
    description: description.value,
    settings: { requireApproval: requireApproval.value, enableSecondReviewer: enableSecondReviewer.value },
  })
  if (!validation.valid) {
    errors.value = validation.errors
    return
  }

  if (!sessionStore.activeProfile) {
    uiStore.toast.error('No active profile. Please sign in.')
    return
  }

  isSubmitting.value = true
  try {
    const result = await roomStore.createRoom({
      name: name.value.trim(),
      description: description.value.trim(),
      hostProfileId: sessionStore.activeProfile.profileId,
      hostDisplayName: sessionStore.activeProfile.displayName,
      hostAvatarColor: sessionStore.activeProfile.avatarColor,
      settings: { requireApproval: requireApproval.value, enableSecondReviewer: enableSecondReviewer.value },
    })
    if (!result.validation.valid) {
      errors.value = result.validation.errors
      return
    }
    if (result.room) {
      addToRecentRooms(result.room.roomId, result.room.name)
      uiStore.toast.success(`Room "${result.room.name}" created!`)
      await router.push({ name: 'workspace', params: { roomId: result.room.roomId } })
    }
  } catch (err) {
    uiStore.toast.error('Failed to create room.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <AppLayout>
    <div class="room-create-page">
      <div class="room-create-page__card">
        <h1 class="room-create-page__title">Create a Room</h1>

        <form class="room-create-page__form" @submit.prevent="submit">
          <!-- Room name -->
          <div class="room-create-page__field">
            <label for="room-name" class="room-create-page__label">Room Name *</label>
            <input
              id="room-name"
              v-model="name"
              class="room-create-page__input"
              :class="{ 'room-create-page__input--error': nameErrors.length > 0 }"
              type="text"
              placeholder="e.g. Sprint Planning"
              maxlength="100"
              :disabled="isSubmitting"
              autocomplete="off"
            />
            <InlineValidation :errors="nameErrors" />
          </div>

          <!-- Description -->
          <div class="room-create-page__field">
            <label for="room-desc" class="room-create-page__label">Description</label>
            <textarea
              id="room-desc"
              v-model="description"
              class="room-create-page__input room-create-page__textarea"
              :class="{ 'room-create-page__input--error': descriptionErrors.length > 0 }"
              placeholder="Optional description"
              maxlength="500"
              rows="3"
              :disabled="isSubmitting"
            />
            <InlineValidation :errors="descriptionErrors" />
          </div>

          <!-- Approval settings -->
          <div class="room-create-page__field">
            <label class="room-create-page__checkbox-label">
              <input v-model="requireApproval" type="checkbox" :disabled="isSubmitting" />
              Require approval to join
            </label>
            <label
              class="room-create-page__checkbox-label"
              :class="{ 'room-create-page__checkbox-label--disabled': !requireApproval }"
            >
              <input
                v-model="enableSecondReviewer"
                type="checkbox"
                :disabled="isSubmitting || !requireApproval"
              />
              Require second Reviewer approval at 15+ members
            </label>
          </div>

          <p class="room-create-page__disclosure">
            Roles (Host, Reviewer, etc.) are UI personas only — they are not a security boundary.
          </p>

          <!-- Actions -->
          <div class="room-create-page__actions">
            <router-link to="/rooms" class="room-create-page__cancel">Cancel</router-link>
            <button
              type="submit"
              class="room-create-page__submit"
              :disabled="isSubmitting"
            >
              {{ isSubmitting ? 'Creating…' : 'Create Room' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.room-create-page {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 3rem 1rem;
  min-height: 100%;
}

.room-create-page__card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 2rem;
  width: 100%;
  max-width: 28rem;
}

.room-create-page__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 1.5rem;
}

.room-create-page__form { display: flex; flex-direction: column; gap: 1rem; }

.room-create-page__field { display: flex; flex-direction: column; gap: 0.25rem; }

.room-create-page__label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
}

.room-create-page__input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.9375rem;
  font-family: inherit;
  color: #1e293b;
  transition: border-color 0.1s;
}
.room-create-page__input:focus { outline: none; border-color: #2563eb; }
.room-create-page__input:disabled { background: #f8fafc; }
.room-create-page__input--error { border-color: #ef4444; }

.room-create-page__textarea { resize: vertical; }

.room-create-page__checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #334155;
  cursor: pointer;
}
.room-create-page__checkbox-label--disabled { opacity: 0.5; cursor: not-allowed; }

.room-create-page__disclosure {
  font-size: 0.75rem;
  color: #94a3b8;
  margin: 0;
}

.room-create-page__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.room-create-page__cancel {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: #64748b;
  text-decoration: none;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.room-create-page__cancel:hover { background: #f1f5f9; }

.room-create-page__submit {
  padding: 0.5rem 1.25rem;
  font-size: 0.9375rem;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}
.room-create-page__submit:hover:not(:disabled) { background: #1d4ed8; }
.room-create-page__submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

<script setup lang="ts">
// REQ: R2 — Room join via pairing code + display name; awaiting-approval state with BroadcastChannel auto-navigation

import { ref, computed, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room-store'
import { useSessionStore } from '@/stores/session-store'
import { useUiStore } from '@/stores/ui-store'
import { validateJoinPayload } from '@/validators/join-validator'
import { roomRepository } from '@/services/room-repository'
import { LS_KEYS, lsGetJSON, lsSetJSON, type RecentRoomEntry } from '@/services/local-storage-keys'
import { subscribeBroadcast } from '@/services/broadcast-channel-service'
import { RoomRole, MembershipState } from '@/models/room'
import type { MembershipChangePayload } from '@/models/broadcast'
import AppLayout from '@/layouts/AppLayout.vue'
import InlineValidation from '@/components/InlineValidation.vue'
import type { FieldError } from '@/models/validation'

type Step = 'form' | 'awaiting' | 'connected'

const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()
const sessionStore = useSessionStore()
const uiStore = useUiStore()

const pairingCode = ref((route.query.code as string | undefined) ?? '')
const displayName = ref(sessionStore.activeProfile?.displayName ?? '')
const requestedRole = ref<RoomRole>(RoomRole.Participant)
const errors = ref<FieldError[]>([])
const isSubmitting = ref(false)
const step = ref<Step>('form')
const pendingRoomId = ref<string | null>(null)

let cleanupApprovalListener: (() => void) | null = null

const pairingCodeErrors = computed(() => errors.value.filter((e) => e.field === 'pairingCode'))
const displayNameErrors = computed(() => errors.value.filter((e) => e.field === 'displayName'))

onUnmounted(() => {
  cleanupApprovalListener?.()
})

function addToRecentRooms(roomId: string, roomName: string): void {
  const existing = lsGetJSON<RecentRoomEntry[]>(LS_KEYS.RECENT_ROOMS) ?? []
  const entry: RecentRoomEntry = { roomId, name: roomName, lastAccessed: new Date().toISOString() }
  const updated = [entry, ...existing.filter((r) => r.roomId !== roomId)].slice(0, 10)
  lsSetJSON(LS_KEYS.RECENT_ROOMS, updated)
}

async function submit(): Promise<void> {
  errors.value = []
  const validation = validateJoinPayload({
    pairingCode: pairingCode.value,
    displayName: displayName.value,
  })
  if (!validation.valid) {
    errors.value = validation.errors
    return
  }

  if (!sessionStore.activeProfile) {
    uiStore.toast.error('No active session. Please sign in first.')
    return
  }

  // Find room by pairing code
  const allRooms = await roomRepository.listAll()
  const room = allRooms.find((r) => r.pairingCode === pairingCode.value.trim().toUpperCase())
  if (!room) {
    errors.value = [{ field: 'pairingCode', message: 'No room found with that pairing code.', code: 'not_found' }]
    return
  }

  isSubmitting.value = true
  try {
    const result = await roomStore.requestJoin({
      roomId: room.roomId,
      requesterId: sessionStore.activeProfile.profileId,
      displayName: displayName.value.trim(),
      avatarColor: sessionStore.activeProfile.avatarColor,
      requestedRole: requestedRole.value,
      requestedAt: new Date().toISOString(),
      pairingCode: pairingCode.value.trim().toUpperCase(),
    })

    if (!result.validation.valid) {
      errors.value = result.validation.errors
      return
    }

    addToRecentRooms(room.roomId, room.name)

    // If room has no approval, the member is auto-Active — navigate directly
    if (!room.settings.requireApproval || result.member?.state === MembershipState.Active) {
      uiStore.toast.success(`Joined "${room.name}"!`)
      await router.push({ name: 'workspace', params: { roomId: room.roomId } })
    } else {
      pendingRoomId.value = room.roomId
      step.value = 'awaiting'
      // Subscribe to membership-change events so the page auto-navigates when the host approves.
      cleanupApprovalListener = subscribeBroadcast<MembershipChangePayload>(
        'membership-change',
        (envelope) => {
          if (
            envelope.payload.operation === 'approve' &&
            envelope.payload.memberId === sessionStore.activeProfile?.profileId &&
            pendingRoomId.value
          ) {
            router.push({ name: 'workspace', params: { roomId: pendingRoomId.value } })
          }
        }
      )
    }
  } catch (err) {
    uiStore.toast.error('Failed to submit join request.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <AppLayout>
    <div class="room-join-page">
      <div class="room-join-page__card">

        <!-- Step: form -->
        <template v-if="step === 'form'">
          <h1 class="room-join-page__title">Join a Room</h1>

          <form class="room-join-page__form" @submit.prevent="submit">
            <!-- Pairing code -->
            <div class="room-join-page__field">
              <label for="join-code" class="room-join-page__label">Pairing Code *</label>
              <div class="room-join-page__code-row">
                <input
                  id="join-code"
                  v-model="pairingCode"
                  class="room-join-page__input"
                  :class="{ 'room-join-page__input--error': pairingCodeErrors.length > 0 }"
                  type="text"
                  placeholder="XXXX-XXXX"
                  maxlength="9"
                  :disabled="isSubmitting"
                  autocomplete="off"
                  style="text-transform:uppercase; letter-spacing: 0.1em; font-family: monospace;"
                />
              </div>
              <InlineValidation :errors="pairingCodeErrors" />
            </div>

            <!-- Display name -->
            <div class="room-join-page__field">
              <label for="join-name" class="room-join-page__label">Your Name *</label>
              <input
                id="join-name"
                v-model="displayName"
                class="room-join-page__input"
                :class="{ 'room-join-page__input--error': displayNameErrors.length > 0 }"
                type="text"
                placeholder="Display name"
                maxlength="60"
                :disabled="isSubmitting"
              />
              <InlineValidation :errors="displayNameErrors" />
            </div>

            <!-- Role selector -->
            <div class="room-join-page__field">
              <label for="join-role" class="room-join-page__label">Join as</label>
              <select
                id="join-role"
                v-model="requestedRole"
                class="room-join-page__input"
                :disabled="isSubmitting"
              >
                <option :value="RoomRole.Participant">Participant</option>
                <option :value="RoomRole.Guest">Guest</option>
              </select>
              <p class="room-join-page__role-note">
                Roles are UI personas only — not a security boundary. Host can reassign roles after joining.
              </p>
            </div>

            <div class="room-join-page__actions">
              <router-link to="/rooms" class="room-join-page__cancel">Cancel</router-link>
              <button
                type="submit"
                class="room-join-page__submit"
                :disabled="isSubmitting"
              >
                {{ isSubmitting ? 'Submitting…' : 'Request to Join' }}
              </button>
            </div>
          </form>
        </template>

        <!-- Step: awaiting approval -->
        <template v-else-if="step === 'awaiting'">
          <div class="room-join-page__awaiting">
            <div class="room-join-page__awaiting-icon">⏳</div>
            <h2 class="room-join-page__awaiting-title">Awaiting Approval</h2>
            <p class="room-join-page__awaiting-desc">
              Your join request has been submitted. The room host or reviewer will approve it.
              You will be redirected automatically when approved.
            </p>
            <router-link to="/rooms" class="room-join-page__submit">Back to Rooms</router-link>
          </div>
        </template>

      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.room-join-page {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 3rem 1rem;
  min-height: 100%;
}

.room-join-page__card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 2rem;
  width: 100%;
  max-width: 26rem;
}

.room-join-page__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 1.5rem;
}

.room-join-page__form { display: flex; flex-direction: column; gap: 1rem; }
.room-join-page__field { display: flex; flex-direction: column; gap: 0.25rem; }

.room-join-page__label { font-size: 0.875rem; font-weight: 600; color: #334155; }

.room-join-page__code-row { display: flex; gap: 0.5rem; }

.room-join-page__input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.9375rem;
  font-family: inherit;
  color: #1e293b;
  flex: 1;
}
.room-join-page__input:focus { outline: none; border-color: #2563eb; }
.room-join-page__input:disabled { background: #f8fafc; }
.room-join-page__input--error { border-color: #ef4444; }

.room-join-page__role-note {
  font-size: 0.75rem;
  color: #94a3b8;
  margin: 0;
}

.room-join-page__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.room-join-page__cancel {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: #64748b;
  text-decoration: none;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.room-join-page__submit {
  display: inline-block;
  padding: 0.5rem 1.25rem;
  font-size: 0.9375rem;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  text-decoration: none;
  text-align: center;
}
.room-join-page__submit:hover:not(:disabled) { background: #1d4ed8; }
.room-join-page__submit:disabled { opacity: 0.5; cursor: not-allowed; }

.room-join-page__awaiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 1rem;
}

.room-join-page__awaiting-icon { font-size: 3rem; }

.room-join-page__awaiting-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.room-join-page__awaiting-desc {
  font-size: 0.875rem;
  color: #64748b;
  line-height: 1.5;
  margin: 0;
}
</style>

<script setup lang="ts">
// REQ: R12 — Local-only profile selection, creation, and passphrase unlock
// REQ: R13 — Handles ForcedSignOut and InactivityLocked re-entry messages
// REQ: R11 — Roles are UI personas only — disclosed on this screen

import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSessionStore } from '@/stores/session-store'
import { useUiStore } from '@/stores/ui-store'
import { validatePassphrase } from '@/validators/passphrase-validator'
import { SessionState } from '@/models/profile'
import InlineValidation from '@/components/InlineValidation.vue'
import type { FieldError } from '@/models/validation'

const router = useRouter()
const route = useRoute()
const sessionStore = useSessionStore()
const uiStore = useUiStore()

// ── View state machine ────────────────────────────────────────────────────────
type View = 'list' | 'create' | 'unlock'
const currentView = ref<View>('list')

// ── Unlock form ───────────────────────────────────────────────────────────────
const selectedProfileId = ref<string | null>(null)
const unlockPassphrase = ref('')
const unlockErrors = ref<FieldError[]>([])

// ── Create profile form ───────────────────────────────────────────────────────
const createDisplayName = ref('')
const createAvatarColor = ref('#3b82f6') // default blue
const createPassphrase = ref('')
const createPassphraseConfirm = ref('')
const createErrors = ref<FieldError[]>([])

const AVATAR_PRESETS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
]

// ── Derived state ─────────────────────────────────────────────────────────────
const sessionMessage = computed(() => {
  if (sessionStore.sessionState === SessionState.InactivityLocked) {
    return 'Your session was locked due to 30 minutes of inactivity. Please unlock to continue.'
  }
  if (sessionStore.sessionState === SessionState.ForcedSignOut) {
    return 'You have been signed out after 8 hours. Please select a profile to continue.'
  }
  return null
})

const selectedProfile = computed(() =>
  sessionStore.profiles.find((p) => p.profileId === selectedProfileId.value) ?? null
)

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  await sessionStore.refreshProfiles()

  // Pre-select the last active profile for inactivity lock re-entry
  if (
    sessionStore.sessionState === SessionState.InactivityLocked &&
    sessionStore.activeProfileId
  ) {
    selectedProfileId.value = sessionStore.activeProfileId
    currentView.value = 'unlock'
  }
})

// ── Navigation helpers ────────────────────────────────────────────────────────
function selectProfile(profileId: string) {
  selectedProfileId.value = profileId
  unlockPassphrase.value = ''
  unlockErrors.value = []
  sessionStore.clearError()
  currentView.value = 'unlock'
}

function goToCreate() {
  createDisplayName.value = ''
  createAvatarColor.value = '#3b82f6'
  createPassphrase.value = ''
  createPassphraseConfirm.value = ''
  createErrors.value = []
  sessionStore.clearError()
  currentView.value = 'create'
}

function goToList() {
  unlockPassphrase.value = ''
  unlockErrors.value = []
  createErrors.value = []
  sessionStore.clearError()
  currentView.value = 'list'
}

// ── Unlock flow ───────────────────────────────────────────────────────────────
async function handleUnlock() {
  if (!selectedProfileId.value) return

  unlockErrors.value = []

  const passphraseResult = validatePassphrase(unlockPassphrase.value)
  if (!passphraseResult.valid) {
    unlockErrors.value = passphraseResult.errors
    return
  }

  const success = await sessionStore.unlock(selectedProfileId.value, unlockPassphrase.value)
  if (success) {
    const redirect = (route.query.redirect as string) || '/rooms'
    await router.push(redirect)
  }
  // On failure, sessionStore.error is set and displayed inline
}

// ── Create flow ───────────────────────────────────────────────────────────────
async function handleCreate() {
  createErrors.value = []

  // Local pre-validation
  const errors: FieldError[] = []

  if (!createDisplayName.value.trim()) {
    errors.push({ field: 'displayName', message: 'Display name is required.', code: 'required' })
  }

  const passphraseResult = validatePassphrase(createPassphrase.value)
  if (!passphraseResult.valid) {
    errors.push(...passphraseResult.errors)
  } else if (createPassphrase.value !== createPassphraseConfirm.value) {
    errors.push({ field: 'confirmPassphrase', message: 'Passphrases do not match.', code: 'invalid_format' })
  }

  if (errors.length > 0) {
    createErrors.value = errors
    return
  }

  try {
    const profile = await sessionStore.createNewProfile(
      createDisplayName.value,
      createAvatarColor.value,
      createPassphrase.value
    )
    uiStore.toast.success(`Profile "${profile.displayName}" created. Please unlock it.`)
    selectedProfileId.value = profile.profileId
    unlockPassphrase.value = ''
    unlockErrors.value = []
    currentView.value = 'unlock'
  } catch {
    // sessionStore.error is populated; errors shown inline
  }
}
</script>

<template>
  <div class="profile-page">
    <div class="profile-card">
      <!-- Header -->
      <div class="profile-card__header">
        <h1 class="profile-card__title">ForgeRoom</h1>
        <p class="profile-card__subtitle">Local workspace — no account required</p>
      </div>

      <!-- Session message (inactivity lock / forced sign-out) -->
      <div v-if="sessionMessage" class="profile-card__session-notice" role="status">
        {{ sessionMessage }}
      </div>

      <!-- ── Profile list view ──────────────────────────────────────────── -->
      <template v-if="currentView === 'list'">
        <div v-if="sessionStore.isLoading" class="profile-card__loading">
          Loading profiles…
        </div>

        <template v-else>
          <div v-if="sessionStore.profiles.length === 0" class="profile-card__empty">
            <p>No profiles yet. Create one to get started.</p>
          </div>

          <ul v-else class="profile-list" role="list">
            <li
              v-for="profile in sessionStore.profiles"
              :key="profile.profileId"
              class="profile-list__item"
            >
              <button
                class="profile-list__button"
                @click="selectProfile(profile.profileId)"
              >
                <span
                  class="profile-list__avatar"
                  :style="{ background: profile.avatarColor }"
                  aria-hidden="true"
                >
                  {{ profile.displayName.charAt(0).toUpperCase() }}
                </span>
                <span class="profile-list__name">{{ profile.displayName }}</span>
                <span class="profile-list__arrow" aria-hidden="true">›</span>
              </button>
            </li>
          </ul>

          <div class="profile-card__actions">
            <button class="btn btn--primary" @click="goToCreate">
              + Create new profile
            </button>
          </div>
        </template>

        <!-- Role disclosure -->
        <p class="profile-card__role-note">
          Roles (Host, Reviewer, Participant, Guest) are local UI personas only and
          are not a security boundary.
        </p>
      </template>

      <!-- ── Unlock view ────────────────────────────────────────────────── -->
      <template v-else-if="currentView === 'unlock'">
        <div v-if="selectedProfile" class="unlock-profile">
          <div class="unlock-profile__avatar-row">
            <span
              class="unlock-profile__avatar"
              :style="{ background: selectedProfile.avatarColor }"
              aria-hidden="true"
            >
              {{ selectedProfile.displayName.charAt(0).toUpperCase() }}
            </span>
            <span class="unlock-profile__name">{{ selectedProfile.displayName }}</span>
          </div>

          <form class="unlock-form" @submit.prevent="handleUnlock" novalidate>
            <div class="form-group">
              <label for="unlock-passphrase" class="form-label">Passphrase</label>
              <input
                id="unlock-passphrase"
                v-model="unlockPassphrase"
                type="password"
                class="form-input"
                :class="{ 'form-input--error': unlockErrors.length > 0 || sessionStore.error }"
                autocomplete="current-password"
                placeholder="Enter your passphrase"
                :disabled="sessionStore.isSubmitting"
                autofocus
              />
              <InlineValidation :errors="unlockErrors" field="passphrase" />
              <p v-if="sessionStore.error" class="form-error" role="alert">
                {{ sessionStore.error }}
              </p>
            </div>

            <div class="form-actions">
              <button
                type="button"
                class="btn btn--secondary"
                :disabled="sessionStore.isSubmitting"
                @click="goToList"
              >
                Back
              </button>
              <button
                type="submit"
                class="btn btn--primary"
                :disabled="sessionStore.isSubmitting || !unlockPassphrase"
              >
                <span v-if="sessionStore.isSubmitting">Unlocking…</span>
                <span v-else>Unlock</span>
              </button>
            </div>
          </form>
        </div>
      </template>

      <!-- ── Create profile view ────────────────────────────────────────── -->
      <template v-else-if="currentView === 'create'">
        <h2 class="profile-card__section-title">Create profile</h2>

        <form class="create-form" @submit.prevent="handleCreate" novalidate>
          <!-- Display name -->
          <div class="form-group">
            <label for="create-name" class="form-label">Display name</label>
            <input
              id="create-name"
              v-model="createDisplayName"
              type="text"
              class="form-input"
              :class="{ 'form-input--error': createErrors.some((e) => e.field === 'displayName') }"
              maxlength="60"
              placeholder="Your name in this workspace"
              :disabled="sessionStore.isSubmitting"
              autofocus
            />
            <InlineValidation :errors="createErrors" field="displayName" />
          </div>

          <!-- Avatar color -->
          <div class="form-group">
            <fieldset class="avatar-picker">
              <legend class="form-label">Avatar color</legend>
              <div class="avatar-picker__swatches">
                <label
                  v-for="color in AVATAR_PRESETS"
                  :key="color"
                  class="avatar-picker__swatch"
                >
                  <input
                    type="radio"
                    name="avatarColor"
                    :value="color"
                    v-model="createAvatarColor"
                    class="avatar-picker__radio"
                  />
                  <span
                    class="avatar-picker__color"
                    :style="{ background: color }"
                    :class="{ 'avatar-picker__color--selected': createAvatarColor === color }"
                  ></span>
                </label>
              </div>
            </fieldset>
          </div>

          <!-- Passphrase -->
          <div class="form-group">
            <label for="create-passphrase" class="form-label">Passphrase</label>
            <input
              id="create-passphrase"
              v-model="createPassphrase"
              type="password"
              class="form-input"
              :class="{ 'form-input--error': createErrors.some((e) => e.field === 'passphrase') }"
              autocomplete="new-password"
              placeholder="Min. 8 characters"
              :disabled="sessionStore.isSubmitting"
            />
            <InlineValidation :errors="createErrors" field="passphrase" />
          </div>

          <!-- Confirm passphrase -->
          <div class="form-group">
            <label for="create-passphrase-confirm" class="form-label">Confirm passphrase</label>
            <input
              id="create-passphrase-confirm"
              v-model="createPassphraseConfirm"
              type="password"
              class="form-input"
              :class="{ 'form-input--error': createErrors.some((e) => e.field === 'confirmPassphrase') }"
              autocomplete="new-password"
              placeholder="Re-enter passphrase"
              :disabled="sessionStore.isSubmitting"
            />
            <InlineValidation :errors="createErrors" field="confirmPassphrase" />
          </div>

          <!-- Store error -->
          <p v-if="sessionStore.error" class="form-error" role="alert">
            {{ sessionStore.error }}
          </p>

          <p class="form-hint">
            Passphrase is stored as a local verifier only — it is never sent anywhere.
            If you forget it, you will need to create a new profile.
          </p>

          <div class="form-actions">
            <button
              type="button"
              class="btn btn--secondary"
              :disabled="sessionStore.isSubmitting"
              @click="goToList"
            >
              Back
            </button>
            <button
              type="submit"
              class="btn btn--primary"
              :disabled="sessionStore.isSubmitting"
            >
              <span v-if="sessionStore.isSubmitting">Creating…</span>
              <span v-else>Create profile</span>
            </button>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fafc;
  padding: 1rem;
}

.profile-card {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 26rem;
  padding: 2rem;
}

.profile-card__header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.profile-card__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111;
  margin: 0 0 0.25rem;
}

.profile-card__subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.profile-card__section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #111;
  margin: 0 0 1rem;
}

.profile-card__session-notice {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  color: #92400e;
  margin-bottom: 1rem;
}

.profile-card__loading {
  text-align: center;
  color: #6b7280;
  padding: 1rem 0;
}

.profile-card__empty {
  text-align: center;
  color: #6b7280;
  padding: 1rem 0;
}

.profile-card__role-note {
  font-size: 0.75rem;
  color: #9ca3af;
  text-align: center;
  margin: 1rem 0 0;
  line-height: 1.4;
}

/* Profile list */
.profile-list {
  list-style: none;
  margin: 0 0 1rem;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}

.profile-list__item + .profile-list__item {
  border-top: 1px solid #e5e7eb;
}

.profile-list__button {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  gap: 0.75rem;
  transition: background 0.1s;
}
.profile-list__button:hover { background: #f9fafb; }

.profile-list__avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
  color: #fff;
  flex-shrink: 0;
}

.profile-list__name {
  flex: 1;
  font-size: 0.9375rem;
  color: #111;
  font-weight: 500;
}

.profile-list__arrow {
  color: #9ca3af;
  font-size: 1.125rem;
}

/* Unlock form */
.unlock-profile {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.unlock-profile__avatar-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.unlock-profile__avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  color: #fff;
  flex-shrink: 0;
}

.unlock-profile__name {
  font-size: 1rem;
  font-weight: 600;
  color: #111;
}

/* Avatar picker */
.avatar-picker { border: none; padding: 0; margin: 0; }

.avatar-picker__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.375rem;
}

.avatar-picker__swatch { cursor: pointer; }
.avatar-picker__radio { position: absolute; opacity: 0; width: 0; height: 0; }

.avatar-picker__color {
  display: block;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  border: 2px solid transparent;
  transition: border-color 0.1s;
}
.avatar-picker__color--selected { border-color: #1e40af; }

/* Shared form styles */
.form-group { display: flex; flex-direction: column; }

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.375rem;
}

.form-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  font-size: 0.9375rem;
  outline: none;
  transition: border-color 0.15s;
}
.form-input:focus { border-color: #2563eb; }
.form-input--error { border-color: #dc2626; }
.form-input:disabled { background: #f3f4f6; color: #9ca3af; cursor: not-allowed; }

.form-error {
  font-size: 0.8125rem;
  color: #dc2626;
  margin: 0.375rem 0 0;
}

.form-hint {
  font-size: 0.8125rem;
  color: #6b7280;
  margin: 0.25rem 0 0;
  line-height: 1.4;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
  margin-top: 0.25rem;
}

.create-form { display: flex; flex-direction: column; gap: 1rem; }

/* Buttons */
.btn {
  padding: 0.5rem 1.125rem;
  border-radius: 5px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.1s;
}
.btn:disabled { opacity: 0.55; cursor: not-allowed; }

.btn--primary { background: #2563eb; color: #fff; }
.btn--primary:hover:not(:disabled) { background: #1d4ed8; }

.btn--secondary { background: #f3f4f6; border-color: #d1d5db; color: #374151; }
.btn--secondary:hover:not(:disabled) { background: #e5e7eb; }

.profile-card__actions { display: flex; justify-content: center; }
</style>

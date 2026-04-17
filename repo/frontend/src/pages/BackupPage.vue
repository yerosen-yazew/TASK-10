<script setup lang="ts">
// REQ: R20 — Backup export/import UI: size check, row-level errors, batch-cap reporting, partial failure feedback

import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useImportExportStore } from '@/stores/import-export-store'
import { useSessionStore } from '@/stores/session-store'
import { useUiStore } from '@/stores/ui-store'
import { MAX_BACKUP_SIZE_BYTES, MAX_BULK_IMPORT_ITEMS } from '@/models/constants'
import type { BackupManifest } from '@/models/backup'
import AppLayout from '@/layouts/AppLayout.vue'

const props = defineProps<{
  roomId: string
}>()

const router = useRouter()
const importExportStore = useImportExportStore()
const sessionStore = useSessionStore()
const uiStore = useUiStore()

const fileInput = ref<HTMLInputElement | null>(null)
const parsedManifest = ref<BackupManifest | null>(null)
const isPersisting = ref(false)
const persistError = ref<string | null>(null)
const persistSuccess = ref(false)

const validationResult = computed(() => importExportStore.lastImportResult)

const hasRowErrors = computed(() =>
  (validationResult.value?.errorRows.length ?? 0) > 0
)

const hasWarnings = computed(() =>
  (validationResult.value?.warnings.length ?? 0) > 0
)

async function doExport(): Promise<void> {
  const displayName = sessionStore.activeProfile?.displayName ?? 'Unknown'
  await importExportStore.exportRoom(props.roomId, displayName)
  if (!importExportStore.lastError) {
    uiStore.toast.success('Backup downloaded.')
  } else {
    uiStore.toast.error(importExportStore.lastError)
  }
}

function triggerFilePicker(): void {
  parsedManifest.value = null
  persistError.value = null
  persistSuccess.value = false
  importExportStore.clearError()
  fileInput.value?.click()
}

async function onFileSelected(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  // Reset input value so re-selecting the same file fires again
  if (fileInput.value) fileInput.value.value = ''

  const result = await importExportStore.validateImport(file)
  if (!result) {
    uiStore.toast.error('Import failed — could not read file.')
    return
  }

  if (result.success) {
    // Parse the manifest only when validation succeeds.
    parsedManifest.value = await importExportStore.parseManifest(file)
  }
}

async function confirmImport(): Promise<void> {
  if (!parsedManifest.value) return

  const confirmed = await uiStore.confirm({
    title: 'Import this backup?',
    message: `This will overwrite existing data for room "${parsedManifest.value.roomName}". This action cannot be undone.`,
    confirmLabel: 'Import',
    danger: true,
  })
  if (!confirmed) return

  isPersisting.value = true
  persistError.value = null
  try {
    await importExportStore.persistImport(parsedManifest.value)
    persistSuccess.value = true
    uiStore.toast.success('Backup imported successfully.')
    // Navigate to the imported room
    await router.push({ name: 'workspace', params: { roomId: parsedManifest.value.roomId } })
  } catch {
    persistError.value = importExportStore.lastError ?? 'Import failed — data may be partially saved.'
    uiStore.toast.error(persistError.value)
  } finally {
    isPersisting.value = false
  }
}

function cancelImport(): void {
  parsedManifest.value = null
  persistError.value = null
  persistSuccess.value = false
  importExportStore.clearError()
}
</script>

<template>
  <AppLayout>
    <div class="backup-page">
      <div class="backup-page__card">
        <div class="backup-page__header">
          <h1 class="backup-page__title">Backup & Restore</h1>
          <router-link :to="`/workspace/${roomId}`" class="backup-page__back">← Back to workspace</router-link>
        </div>

        <!-- Export section -->
        <section class="backup-page__section">
          <h2 class="backup-page__section-title">Export Room Backup</h2>
          <p class="backup-page__desc">
            Download a complete backup of this room (elements, comments, chat, snapshots).
            Maximum file size: {{ (MAX_BACKUP_SIZE_BYTES / 1024 / 1024).toFixed(0) }} MB.
          </p>

          <div v-if="importExportStore.isExporting" class="backup-page__progress">
            <div class="backup-page__progress-bar">
              <div
                class="backup-page__progress-fill"
                :style="{ width: `${importExportStore.exportProgress}%` }"
              />
            </div>
            <span class="backup-page__progress-label">{{ importExportStore.exportProgress }}%</span>
          </div>

          <p v-if="importExportStore.lastError && !importExportStore.isImporting" class="backup-page__error" data-testid="export-error">
            {{ importExportStore.lastError }}
          </p>

          <button
            class="backup-page__btn backup-page__btn--primary"
            :disabled="importExportStore.isExporting"
            data-testid="export-btn"
            @click="doExport"
          >
            {{ importExportStore.isExporting ? 'Exporting…' : 'Download Backup' }}
          </button>
        </section>

        <div class="backup-page__divider" />

        <!-- Import section -->
        <section class="backup-page__section">
          <h2 class="backup-page__section-title">Import Room Backup</h2>
          <p class="backup-page__desc">
            Import a previously exported <code>.json</code> backup file.
            Only ForgeRoom backup files (format <code>forgeroom-backup-v1</code>) are accepted.
          </p>

          <input
            ref="fileInput"
            type="file"
            accept=".json,application/json"
            class="backup-page__file-input"
            data-testid="file-input"
            @change="onFileSelected"
          />

          <button
            class="backup-page__btn"
            :disabled="importExportStore.isImporting"
            data-testid="pick-file-btn"
            @click="triggerFilePicker"
          >
            {{ importExportStore.isImporting ? 'Validating…' : 'Choose Backup File…' }}
          </button>

          <!-- Import progress -->
          <div v-if="importExportStore.isImporting" class="backup-page__progress">
            <div class="backup-page__progress-bar">
              <div
                class="backup-page__progress-fill"
                :style="{ width: `${importExportStore.importProgress}%` }"
              />
            </div>
            <span class="backup-page__progress-label">{{ importExportStore.importProgress }}%</span>
          </div>

          <!-- Validation results -->
          <template v-if="validationResult && !importExportStore.isImporting">
            <div
              class="backup-page__validation"
              :class="{
                'backup-page__validation--success': validationResult.success,
                'backup-page__validation--error': !validationResult.success,
              }"
              data-testid="validation-result"
            >
              <div class="backup-page__validation-summary">
                <span v-if="validationResult.success">
                  ✓ Valid backup — {{ validationResult.validRows }} rows ready to import
                </span>
                <span v-else>
                  ✗ Validation failed — {{ validationResult.errorRows.length }} error(s) found
                </span>
              </div>

              <!-- Warnings (truncation, batch cap) -->
              <ul v-if="hasWarnings" class="backup-page__warnings" data-testid="import-warnings">
                <li v-for="(warn, i) in validationResult.warnings" :key="i" class="backup-page__warning-item">
                  ⚠ {{ warn }}
                </li>
              </ul>

              <!-- Row-level errors -->
              <div v-if="hasRowErrors" class="backup-page__row-errors" data-testid="row-errors">
                <p class="backup-page__row-errors-title">Row-level errors:</p>
                <ul class="backup-page__row-error-list">
                  <li
                    v-for="(err, i) in validationResult.errorRows.slice(0, 20)"
                    :key="i"
                    class="backup-page__row-error-item"
                  >
                    <span class="backup-page__row-error-type">{{ err.rowType }}[{{ err.rowIndex }}]</span>
                    {{ err.field ? `${err.field}: ` : '' }}{{ err.error }}
                  </li>
                </ul>
                <p v-if="validationResult.errorRows.length > 20" class="backup-page__row-errors-more">
                  …and {{ validationResult.errorRows.length - 20 }} more errors.
                </p>
              </div>

              <!-- Blocked-import notice when batch cap is exceeded -->
              <div v-if="validationResult.truncated" class="backup-page__truncation-notice" data-testid="truncation-notice">
                <p>
                  The batch exceeds the {{ MAX_BULK_IMPORT_ITEMS }}-item limit for sticky notes + comments.
                  Import is blocked until the backup is reduced below the cap.
                </p>
              </div>
            </div>

            <!-- Manifest preview -->
            <div v-if="parsedManifest" class="backup-page__manifest-preview" data-testid="manifest-preview">
              <p><strong>Room:</strong> {{ parsedManifest.roomName }}</p>
              <p><strong>Exported:</strong> {{ new Date(parsedManifest.exportedAt).toLocaleString() }}</p>
              <p><strong>By:</strong> {{ parsedManifest.exportedBy }}</p>
              <p>
                <strong>Contents:</strong>
                {{ parsedManifest.stats.totalElements }} elements,
                {{ parsedManifest.stats.totalComments }} comments,
                {{ parsedManifest.stats.totalChatMessages }} messages,
                {{ parsedManifest.stats.totalSnapshots }} snapshots
              </p>
            </div>

            <p v-if="persistError" class="backup-page__error" data-testid="persist-error">
              {{ persistError }}
              <br />
              <strong>Note:</strong> Data may be partially saved. Check the room state before retrying.
            </p>

            <div v-if="validationResult.success && parsedManifest" class="backup-page__import-actions">
              <button
                class="backup-page__btn"
                :disabled="isPersisting"
                @click="cancelImport"
              >
                Cancel
              </button>
              <button
                class="backup-page__btn backup-page__btn--primary"
                :disabled="isPersisting"
                data-testid="confirm-import-btn"
                @click="confirmImport"
              >
                {{ isPersisting ? 'Importing…' : 'Import Backup' }}
              </button>
            </div>
          </template>
        </section>
      </div>
    </div>
  </AppLayout>
</template>

<style scoped>
.backup-page {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 2rem 1rem;
  min-height: 100%;
}

.backup-page__card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 2rem;
  width: 100%;
  max-width: 36rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.backup-page__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.backup-page__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.backup-page__back {
  font-size: 0.8125rem;
  color: #2563eb;
  text-decoration: none;
  flex-shrink: 0;
}
.backup-page__back:hover { text-decoration: underline; }

.backup-page__section { display: flex; flex-direction: column; gap: 0.75rem; }

.backup-page__section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.backup-page__desc {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}

.backup-page__divider {
  border: none;
  border-top: 1px solid #e2e8f0;
}

.backup-page__file-input { display: none; }

.backup-page__progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.backup-page__progress-bar {
  flex: 1;
  height: 0.375rem;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
}

.backup-page__progress-fill {
  height: 100%;
  background: #2563eb;
  transition: width 0.2s ease;
}

.backup-page__progress-label {
  font-size: 0.75rem;
  color: #64748b;
  flex-shrink: 0;
}

.backup-page__error {
  font-size: 0.875rem;
  color: #b91c1c;
  background: #fee2e2;
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  margin: 0;
  line-height: 1.5;
}

.backup-page__btn {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  color: #1e293b;
  align-self: flex-start;
}
.backup-page__btn:hover:not(:disabled) { background: #e2e8f0; }
.backup-page__btn:disabled { opacity: 0.5; cursor: not-allowed; }
.backup-page__btn--primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.backup-page__btn--primary:hover:not(:disabled) { background: #1d4ed8; }

.backup-page__validation {
  border-radius: 6px;
  padding: 0.75rem;
  font-size: 0.875rem;
}

.backup-page__validation--success {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #15803d;
}

.backup-page__validation--error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

.backup-page__validation-summary { font-weight: 600; margin-bottom: 0.5rem; }

.backup-page__warnings { margin: 0.5rem 0 0; padding-left: 1.25rem; }
.backup-page__warning-item { font-size: 0.8125rem; color: #92400e; margin-bottom: 0.25rem; }

.backup-page__row-errors {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #fecaca;
}

.backup-page__row-errors-title {
  font-weight: 600;
  font-size: 0.8125rem;
  margin: 0 0 0.375rem;
  color: #b91c1c;
}

.backup-page__row-error-list { margin: 0; padding-left: 1.25rem; }
.backup-page__row-error-item { font-size: 0.75rem; color: #7f1d1d; margin-bottom: 0.125rem; }
.backup-page__row-error-type { font-family: monospace; margin-right: 0.25rem; }
.backup-page__row-errors-more { font-size: 0.75rem; color: #64748b; margin: 0.25rem 0 0; }

.backup-page__truncation-notice {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: #fefce8;
  border-radius: 4px;
  font-size: 0.8125rem;
  color: #92400e;
}
.backup-page__truncation-notice p { margin: 0; }

.backup-page__manifest-preview {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.75rem;
  font-size: 0.8125rem;
  color: #334155;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.backup-page__manifest-preview p { margin: 0; }

.backup-page__import-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}
</style>

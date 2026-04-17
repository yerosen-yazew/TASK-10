// REQ: Shared feedback primitives — toasts, banners, and modal confirmations
// Used by all screens that need transient feedback, persistent warnings, or confirmation dialogs.

import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastType = 'info' | 'success' | 'warning' | 'error'
export type BannerType = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: string
  message: string
  type: ToastType
  durationMs: number
}

export interface Banner {
  id: string
  message: string
  type: BannerType
  /** Whether the user can manually dismiss this banner. */
  dismissible: boolean
}

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** If true, the confirm button will be styled as a destructive/danger action. */
  danger?: boolean
}

interface PendingConfirm {
  options: ConfirmOptions
  resolve: (confirmed: boolean) => void
}

let idCounter = 0
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`
}

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([])
  const banners = ref<Banner[]>([])
  const pendingConfirm = ref<PendingConfirm | null>(null)

  // ── Toasts ────────────────────────────────────────────────────────────────

  function addToast(message: string, type: ToastType = 'info', durationMs = 4000): string {
    const id = nextId('toast')
    toasts.value.push({ id, message, type, durationMs })
    if (durationMs > 0) {
      setTimeout(() => removeToast(id), durationMs)
    }
    return id
  }

  function removeToast(id: string): void {
    const idx = toasts.value.findIndex((t) => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  function clearToasts(): void {
    toasts.value = []
  }

  /** Convenience namespace for typed toast creation. */
  const toast = {
    info: (msg: string, ms?: number) => addToast(msg, 'info', ms),
    success: (msg: string, ms?: number) => addToast(msg, 'success', ms),
    warning: (msg: string, ms?: number) => addToast(msg, 'warning', ms),
    error: (msg: string, ms?: number) => addToast(msg, 'error', ms),
  }

  // ── Banners ───────────────────────────────────────────────────────────────

  /**
   * Show a persistent banner. Returns the banner ID for later removal.
   * Unlike toasts, banners do not auto-dismiss.
   */
  function addBanner(message: string, type: BannerType = 'info', dismissible = true): string {
    const id = nextId('banner')
    banners.value.push({ id, message, type, dismissible })
    return id
  }

  function removeBanner(id: string): void {
    const idx = banners.value.findIndex((b) => b.id === id)
    if (idx !== -1) banners.value.splice(idx, 1)
  }

  function clearBanners(): void {
    banners.value = []
  }

  // ── Modal Confirmation ────────────────────────────────────────────────────

  /**
   * Show a modal confirmation dialog. Returns a Promise that resolves to
   * true (confirmed) or false (cancelled/dismissed).
   *
   * Only one confirmation dialog can be open at a time — calling this while
   * another is pending rejects the pending one and shows the new one.
   */
  function confirm(options: ConfirmOptions): Promise<boolean> {
    // Cancel any pending confirm to avoid orphaned promises
    if (pendingConfirm.value) {
      pendingConfirm.value.resolve(false)
    }
    return new Promise<boolean>((resolve) => {
      pendingConfirm.value = { options, resolve }
    })
  }

  /**
   * Resolve the current confirmation dialog.
   * Called by the ConfirmModal component when the user clicks confirm or cancel.
   */
  function resolveConfirm(confirmed: boolean): void {
    if (pendingConfirm.value) {
      pendingConfirm.value.resolve(confirmed)
      pendingConfirm.value = null
    }
  }

  return {
    // state
    toasts,
    banners,
    pendingConfirm,
    // toast actions
    addToast,
    removeToast,
    clearToasts,
    toast,
    // banner actions
    addBanner,
    removeBanner,
    clearBanners,
    // modal actions
    confirm,
    resolveConfirm,
  }
})

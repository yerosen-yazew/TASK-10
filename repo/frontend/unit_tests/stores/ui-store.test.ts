// REQ: R14 — Shared feedback primitives (toast, banner, confirm modal) drive conflict + error UX

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '@/stores/ui-store'

describe('useUiStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Toasts ──────────────────────────────────────────────────────────────────

  describe('toasts', () => {
    it('adds a toast with correct type and message', () => {
      const store = useUiStore()
      store.addToast('Hello', 'success', 3000)
      expect(store.toasts).toHaveLength(1)
      expect(store.toasts[0].message).toBe('Hello')
      expect(store.toasts[0].type).toBe('success')
    })

    it('auto-removes toast after its duration', () => {
      const store = useUiStore()
      store.addToast('Temp', 'info', 1000)
      expect(store.toasts).toHaveLength(1)
      vi.advanceTimersByTime(1100)
      expect(store.toasts).toHaveLength(0)
    })

    it('does not auto-remove toast with durationMs=0', () => {
      const store = useUiStore()
      store.addToast('Permanent', 'warning', 0)
      vi.advanceTimersByTime(60_000)
      expect(store.toasts).toHaveLength(1)
    })

    it('removeToast removes the correct toast', () => {
      const store = useUiStore()
      const id = store.addToast('A', 'error', 0)
      store.addToast('B', 'info', 0)
      store.removeToast(id)
      expect(store.toasts).toHaveLength(1)
      expect(store.toasts[0].message).toBe('B')
    })

    it('clearToasts removes all toasts', () => {
      const store = useUiStore()
      store.addToast('1', 'info', 0)
      store.addToast('2', 'info', 0)
      store.clearToasts()
      expect(store.toasts).toHaveLength(0)
    })

    it('toast.success convenience method creates a success toast', () => {
      const store = useUiStore()
      store.toast.success('Done!')
      expect(store.toasts[0].type).toBe('success')
    })

    it('toast.error convenience method creates an error toast', () => {
      const store = useUiStore()
      store.toast.error('Failed!')
      expect(store.toasts[0].type).toBe('error')
    })
  })

  // ── Banners ─────────────────────────────────────────────────────────────────

  describe('banners', () => {
    it('adds a banner', () => {
      const store = useUiStore()
      store.addBanner('Conflict detected', 'warning')
      expect(store.banners).toHaveLength(1)
      expect(store.banners[0].message).toBe('Conflict detected')
      expect(store.banners[0].dismissible).toBe(true)
    })

    it('removeBanner removes by id', () => {
      const store = useUiStore()
      const id = store.addBanner('Banner 1', 'info')
      store.addBanner('Banner 2', 'error')
      store.removeBanner(id)
      expect(store.banners).toHaveLength(1)
      expect(store.banners[0].message).toBe('Banner 2')
    })

    it('clearBanners removes all banners', () => {
      const store = useUiStore()
      store.addBanner('A', 'info')
      store.addBanner('B', 'warning')
      store.clearBanners()
      expect(store.banners).toHaveLength(0)
    })

    it('non-dismissible banner is created with dismissible=false', () => {
      const store = useUiStore()
      store.addBanner('System notice', 'error', false)
      expect(store.banners[0].dismissible).toBe(false)
    })
  })

  // ── Confirm modal ────────────────────────────────────────────────────────────

  describe('confirm modal', () => {
    it('sets pendingConfirm when confirm() is called', () => {
      const store = useUiStore()
      store.confirm({ title: 'Delete?', message: 'This cannot be undone.' })
      expect(store.pendingConfirm).not.toBeNull()
      expect(store.pendingConfirm?.options.title).toBe('Delete?')
    })

    it('resolves the promise with true when resolveConfirm(true) is called', async () => {
      const store = useUiStore()
      const promise = store.confirm({ title: 'Test', message: 'Continue?' })
      store.resolveConfirm(true)
      const result = await promise
      expect(result).toBe(true)
      expect(store.pendingConfirm).toBeNull()
    })

    it('resolves the promise with false when resolveConfirm(false) is called', async () => {
      const store = useUiStore()
      const promise = store.confirm({ title: 'Test', message: 'Cancel?' })
      store.resolveConfirm(false)
      const result = await promise
      expect(result).toBe(false)
    })

    it('cancels a pending confirm when a new one is shown', async () => {
      const store = useUiStore()
      const first = store.confirm({ title: 'First', message: 'First msg' })
      const second = store.confirm({ title: 'Second', message: 'Second msg' })

      store.resolveConfirm(true)

      const firstResult = await first
      const secondResult = await second
      // First should have been cancelled (false), second confirmed (true)
      expect(firstResult).toBe(false)
      expect(secondResult).toBe(true)
    })

    it('does nothing if resolveConfirm is called with no pending confirm', () => {
      const store = useUiStore()
      expect(() => store.resolveConfirm(true)).not.toThrow()
    })
  })
})

// REQ: R9 — Thin harness exposing presence engine to UI

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PresenceState } from '@/models/presence'
import * as presenceEngine from '@/engine/presence-engine'

export const usePresenceStore = defineStore('presence', () => {
  const roster = ref<PresenceState[]>([])
  const roomId = ref<string | null>(null)
  let unsubscribe: (() => void) | null = null

  const onlineAvatars = computed(() => roster.value.filter((p) => p.isOnline))
  const cursors = computed(() => roster.value.filter((p) => p.cursor !== null))

  function attach(newRoomId: string): void {
    if (roomId.value === newRoomId) return
    detach()
    roomId.value = newRoomId
    roster.value = presenceEngine.listPresent(newRoomId)
    unsubscribe = presenceEngine.subscribe(newRoomId, (states) => {
      roster.value = states
    })
  }

  function detach(): void {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    roster.value = []
    roomId.value = null
  }

  function setSelf(state: PresenceState): void {
    presenceEngine.setPresence(state)
  }

  function updateCursor(memberId: string, cursor: PresenceState['cursor']): void {
    if (!roomId.value) return
    presenceEngine.updateCursor(roomId.value, memberId, cursor)
  }

  function leave(memberId: string): void {
    if (!roomId.value) return
    presenceEngine.leavePresence(roomId.value, memberId)
  }

  return {
    roster,
    roomId,
    onlineAvatars,
    cursors,
    attach,
    detach,
    setSelf,
    updateCursor,
    leave,
  }
})

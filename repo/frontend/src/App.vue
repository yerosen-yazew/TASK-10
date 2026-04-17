<script setup lang="ts">
// REQ: Root application component — mounts session, initializes activity tracking
// REQ: R13 — Records user activity to drive the inactivity lock timer

import { onMounted, onUnmounted } from 'vue'
import { useSessionStore } from '@/stores/session-store'
import { useUiStore } from '@/stores/ui-store'
import { initBroadcastChannel, closeBroadcastChannel } from '@/services/broadcast-channel-service'
import { generateId } from '@/utils/id-generator'

const sessionStore = useSessionStore()
// Instantiate ui store early so it is available to all children
useUiStore()

let activityTimeout: ReturnType<typeof setTimeout> | null = null

function handleActivity() {
  // Debounce activity recording to avoid excessive calls
  if (activityTimeout) return
  activityTimeout = setTimeout(() => {
    sessionStore.recordActivity()
    activityTimeout = null
  }, 1000)
}

onMounted(async () => {
  // Initialize session state from LocalStorage on every app load
  await sessionStore.initialize()

  // Initialize BroadcastChannel for this tab session (not available in all test/SSR envs)
  if (typeof BroadcastChannel !== 'undefined') {
    initBroadcastChannel(generateId())
  }

  // Track user activity for inactivity timer reset
  window.addEventListener('mousemove', handleActivity, { passive: true })
  window.addEventListener('keydown', handleActivity, { passive: true })
  window.addEventListener('click', handleActivity, { passive: true })
  window.addEventListener('scroll', handleActivity, { passive: true, capture: true })
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleActivity)
  window.removeEventListener('keydown', handleActivity)
  window.removeEventListener('click', handleActivity)
  window.removeEventListener('scroll', handleActivity)
  closeBroadcastChannel()
})
</script>

<template>
  <router-view />
</template>

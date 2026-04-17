// REQ: R10 — Thin harness exposing activity feed to UI

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ActivityEvent } from '@/models/activity'
import { ActivityFilter } from '@/models/activity'
import * as activityEngine from '@/engine/activity-engine'
import { logger } from '@/utils/logger'

export const useActivityStore = defineStore('activity', () => {
  const events = ref<ActivityEvent[]>([])
  const filter = ref<ActivityFilter>(ActivityFilter.All)
  const actorFilter = ref<string | null>(null)
  const isLoading = ref(false)
  const lastError = ref<string | null>(null)

  const filteredEvents = computed(() => {
    if (!actorFilter.value) return events.value
    return events.value.filter((e) => e.actorId === actorFilter.value)
  })

  async function refresh(roomId: string): Promise<void> {
    isLoading.value = true
    lastError.value = null
    try {
      events.value = await activityEngine.listActivityFiltered(roomId, {
        filter: filter.value,
        actorId: actorFilter.value ?? undefined,
      })
    } catch (err) {
      logger.error('Failed to refresh activity', { roomId, err })
      lastError.value = 'Failed to load activity feed.'
    } finally {
      isLoading.value = false
    }
  }

  function setFilter(next: ActivityFilter): void {
    filter.value = next
  }

  function setActorFilter(memberId: string | null): void {
    actorFilter.value = memberId
  }

  return {
    events,
    filter,
    actorFilter,
    filteredEvents,
    isLoading,
    lastError,
    refresh,
    setFilter,
    setActorFilter,
  }
})

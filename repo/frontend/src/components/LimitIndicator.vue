<script setup lang="ts">
// REQ: R6/R7/R8 — Reusable cap progress indicator for element, comment, chat limits

import { computed } from 'vue'

const props = defineProps<{
  current: number
  max: number
  label: string
}>()

const pct = computed(() => Math.min(100, Math.round((props.current / props.max) * 100)))
const isWarning = computed(() => pct.value >= 90)
const isFull = computed(() => props.current >= props.max)

const displayText = computed(
  () => `${props.current.toLocaleString()} / ${props.max.toLocaleString()} ${props.label}`
)
</script>

<template>
  <div class="limit-indicator" :class="{ 'limit-indicator--warning': isWarning, 'limit-indicator--full': isFull }">
    <div class="limit-indicator__bar-track">
      <div
        class="limit-indicator__bar-fill"
        :style="{ width: pct + '%' }"
        role="progressbar"
        :aria-valuenow="current"
        :aria-valuemin="0"
        :aria-valuemax="max"
        :aria-label="displayText"
      />
    </div>
    <span class="limit-indicator__text">{{ displayText }}</span>
  </div>
</template>

<style scoped>
.limit-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #64748b;
}

.limit-indicator__bar-track {
  flex: 1;
  height: 4px;
  background: #e2e8f0;
  border-radius: 2px;
  overflow: hidden;
  min-width: 3rem;
}

.limit-indicator__bar-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 2px;
  transition: width 0.2s ease;
}

.limit-indicator--warning .limit-indicator__bar-fill { background: #f97316; }
.limit-indicator--full .limit-indicator__bar-fill { background: #ef4444; }
.limit-indicator--warning .limit-indicator__text,
.limit-indicator--full .limit-indicator__text { color: #ef4444; font-weight: 600; }
</style>

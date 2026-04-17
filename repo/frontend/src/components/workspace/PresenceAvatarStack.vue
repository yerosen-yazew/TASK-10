<script setup lang="ts">
// REQ: R9 — Presence: avatar stack for online members

import { computed } from 'vue'
import type { PresenceState } from '@/models/presence'

const MAX_VISIBLE = 5

const props = defineProps<{
  members: PresenceState[]
}>()

const visible = computed(() => props.members.slice(0, MAX_VISIBLE))
const overflow = computed(() => Math.max(0, props.members.length - MAX_VISIBLE))

function tooltipText(m: PresenceState): string {
  const parts = [m.displayName]
  if (m.currentTool) parts.push(`using ${m.currentTool}`)
  if (!m.isOnline) parts.push('(idle)')
  return parts.join(' — ')
}
</script>

<template>
  <div class="presence-stack" role="list" aria-label="Online members">
    <div
      v-for="m in visible"
      :key="m.memberId"
      class="presence-stack__avatar"
      :class="{ 'presence-stack__avatar--idle': !m.isOnline }"
      :style="{ background: m.avatarColor }"
      :title="tooltipText(m)"
      role="listitem"
    >
      {{ m.displayName.charAt(0).toUpperCase() }}
    </div>
    <div v-if="overflow > 0" class="presence-stack__overflow" :title="`${overflow} more members`">
      +{{ overflow }}
    </div>
  </div>
</template>

<style scoped>
.presence-stack {
  display: flex;
  align-items: center;
  gap: -0.375rem;
}

.presence-stack__avatar {
  width: 1.625rem;
  height: 1.625rem;
  border-radius: 50%;
  border: 2px solid #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #fff;
  margin-left: -0.375rem;
  cursor: default;
  flex-shrink: 0;
}
.presence-stack__avatar:first-child { margin-left: 0; }
.presence-stack__avatar--idle { opacity: 0.45; }

.presence-stack__overflow {
  margin-left: 0.25rem;
  font-size: 0.6875rem;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  padding: 0.125rem 0.375rem;
  cursor: default;
}
</style>

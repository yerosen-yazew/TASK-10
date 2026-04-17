<!-- REQ: R9 — Presence cursor overlay: renders remote-member cursors with name tags -->

<template>
  <div class="cursor-overlay" aria-hidden="true">
    <div
      v-for="peer in visibleCursors"
      :key="peer.memberId"
      class="cursor-overlay__marker"
      :data-testid="`cursor-${peer.memberId}`"
      :style="{
        transform: `translate(${peer.cursor!.x}px, ${peer.cursor!.y}px)`,
      }"
    >
      <span
        class="cursor-overlay__dot"
        :style="{ backgroundColor: peer.avatarColor }"
      />
      <span
        class="cursor-overlay__label"
        :style="{ backgroundColor: peer.avatarColor }"
      >
        {{ peer.displayName }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePresenceStore } from '@/stores/presence-store'

const props = defineProps<{
  selfMemberId: string | null
}>()

const presence = usePresenceStore()

const visibleCursors = computed(() =>
  presence.cursors.filter(
    (p) => p.cursor !== null && p.memberId !== props.selfMemberId
  )
)
</script>

<style scoped>
.cursor-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20;
}

.cursor-overlay__marker {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  will-change: transform;
}

.cursor-overlay__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}

.cursor-overlay__label {
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
</style>

<script setup lang="ts">
// REQ: R1/R3/R4 — Room member list with approval controls

import { computed } from 'vue'
import { useRoomStore } from '@/stores/room-store'
import { useSessionStore } from '@/stores/session-store'
import { MembershipState, RoomRole } from '@/models/room'
import StatusBadge from '@/components/StatusBadge.vue'
import ApprovalQueue from '@/components/workspace/ApprovalQueue.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'

const roomStore = useRoomStore()
const sessionStore = useSessionStore()

const currentRole = computed<RoomRole | null>(() => {
  if (!sessionStore.activeProfileId || !roomStore.activeRoom) return null
  const member = roomStore.members.find((m) => m.memberId === sessionStore.activeProfileId)
  return member?.role ?? null
})

const canApprove = computed(() =>
  currentRole.value === RoomRole.Host || currentRole.value === RoomRole.Reviewer
)
</script>

<template>
  <div class="member-list">
    <LoadingSpinner v-if="roomStore.isLoading" size="sm" />

    <template v-else>
      <!-- Approval queue (Host/Reviewer only) -->
      <ApprovalQueue
        v-if="canApprove && roomStore.pendingMembers.length > 0"
        :pending="roomStore.pendingMembers"
        :activeCount="roomStore.activeMembers.length"
      />

      <!-- Active members -->
      <section class="member-list__section">
        <h3 class="member-list__heading">
          Active ({{ roomStore.activeMembers.length }})
        </h3>
        <ul class="member-list__list">
          <li
            v-for="m in roomStore.activeMembers"
            :key="m.memberId"
            class="member-list__item"
          >
            <span
              class="member-list__avatar"
              :style="{ background: m.avatarColor }"
            >{{ m.displayName.charAt(0).toUpperCase() }}</span>
            <span class="member-list__name">{{ m.displayName }}</span>
            <span class="member-list__role">{{ m.role }}</span>
          </li>
        </ul>
      </section>

      <!-- Left / Rejected members -->
      <section
        v-if="roomStore.members.filter(m => m.state === MembershipState.Left || m.state === MembershipState.Rejected).length > 0"
        class="member-list__section member-list__section--dimmed"
      >
        <h3 class="member-list__heading">Past</h3>
        <ul class="member-list__list">
          <li
            v-for="m in roomStore.members.filter(m => m.state === MembershipState.Left || m.state === MembershipState.Rejected)"
            :key="m.memberId"
            class="member-list__item"
          >
            <span
              class="member-list__avatar member-list__avatar--dimmed"
              :style="{ background: m.avatarColor }"
            >{{ m.displayName.charAt(0).toUpperCase() }}</span>
            <span class="member-list__name">{{ m.displayName }}</span>
            <StatusBadge :status="m.state" size="sm" />
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.member-list { padding: 0.5rem 0; overflow-y: auto; flex: 1; }

.member-list__section { margin-bottom: 0.5rem; }
.member-list__section--dimmed { opacity: 0.6; }

.member-list__heading {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  padding: 0.375rem 0.75rem 0.25rem;
  margin: 0;
}

.member-list__list { list-style: none; padding: 0; margin: 0; }

.member-list__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
}

.member-list__avatar {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.member-list__avatar--dimmed { opacity: 0.6; }

.member-list__name {
  flex: 1;
  font-size: 0.8125rem;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-list__role {
  font-size: 0.6875rem;
  color: #94a3b8;
  text-transform: capitalize;
}
</style>

<script setup lang="ts">
// REQ: R3/R4 — Approval queue: pending join requests with approve/deny, dual-reviewer badge

import { computed } from 'vue'
import { useRoomStore } from '@/stores/room-store'
import { useSessionStore } from '@/stores/session-store'
import { useUiStore } from '@/stores/ui-store'
import { MembershipState, RoomRole } from '@/models/room'
import type { MemberRecord } from '@/models/room'
import { MAX_ROOM_MEMBERS } from '@/models/constants'
import StatusBadge from '@/components/StatusBadge.vue'
import type { ApprovalActor } from '@/engine/membership-engine'

const props = defineProps<{
  pending: MemberRecord[]
  activeCount: number
}>()

const roomStore = useRoomStore()
const sessionStore = useSessionStore()
const uiStore = useUiStore()

const atMemberCap = computed(() => props.activeCount >= MAX_ROOM_MEMBERS)

function buildActor(): ApprovalActor | null {
  if (!sessionStore.activeProfileId || !sessionStore.activeProfile) return null
  const member = roomStore.members.find((m) => m.memberId === sessionStore.activeProfileId)
  if (!member) return null
  return {
    memberId: member.memberId,
    displayName: member.displayName,
    role: member.role,
  }
}

async function approve(memberId: string): Promise<void> {
  const actor = buildActor()
  if (!actor) return
  const result = await roomStore.approveJoin(memberId, actor)
  if (!result.validation.valid) {
    uiStore.toast.error(result.validation.errors[0]?.message ?? 'Approval failed.')
  } else {
    uiStore.toast.success('Member approved.')
  }
}

async function deny(member: MemberRecord): Promise<void> {
  const confirmed = await uiStore.confirm({
    title: `Deny ${member.displayName}?`,
    message: 'This will reject their join request.',
    confirmLabel: 'Deny',
    danger: true,
  })
  if (!confirmed) return
  const actor = buildActor()
  if (!actor) return
  const result = await roomStore.denyJoin(member.memberId, actor)
  if (!result.validation.valid) {
    uiStore.toast.error(result.validation.errors[0]?.message ?? 'Deny failed.')
  } else {
    uiStore.toast.info(`${member.displayName} denied.`)
  }
}
</script>

<template>
  <section class="approval-queue">
    <h3 class="approval-queue__heading">
      Awaiting Approval ({{ pending.length }})
    </h3>

    <ul class="approval-queue__list">
      <li
        v-for="m in pending"
        :key="m.memberId"
        class="approval-queue__item"
      >
        <span
          class="approval-queue__avatar"
          :style="{ background: m.avatarColor }"
        >{{ m.displayName.charAt(0).toUpperCase() }}</span>

        <div class="approval-queue__info">
          <span class="approval-queue__name">{{ m.displayName }}</span>
          <div class="approval-queue__badges">
            <StatusBadge :status="m.state" size="sm" />
            <span
              v-if="m.state === MembershipState.PendingSecondApproval"
              class="approval-queue__second-badge"
              title="Requires a second, distinct reviewer approval"
            >
              2nd approval needed
            </span>
          </div>
        </div>

        <div class="approval-queue__actions">
          <button
            class="approval-queue__btn approval-queue__btn--approve"
            :data-testid="`approve-btn-${m.memberId}`"
            :disabled="atMemberCap"
            :title="atMemberCap ? `Room is at the ${MAX_ROOM_MEMBERS}-member limit` : 'Approve'"
            @click="approve(m.memberId)"
          >
            ✓
          </button>
          <button
            class="approval-queue__btn approval-queue__btn--deny"
            :data-testid="`deny-btn-${m.memberId}`"
            title="Deny"
            @click="deny(m)"
          >
            ✕
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.approval-queue {
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.5rem;
  margin-bottom: 0.25rem;
}

.approval-queue__heading {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #f97316;
  padding: 0.375rem 0.75rem 0.25rem;
  margin: 0;
}

.approval-queue__list { list-style: none; padding: 0; margin: 0; }

.approval-queue__item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
}

.approval-queue__avatar {
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

.approval-queue__info { flex: 1; min-width: 0; }
.approval-queue__name {
  display: block;
  font-size: 0.8125rem;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.approval-queue__badges { display: flex; gap: 0.25rem; margin-top: 0.125rem; flex-wrap: wrap; }

.approval-queue__second-badge {
  font-size: 0.6rem;
  background: #fef9c3;
  color: #854d0e;
  border-radius: 2px;
  padding: 0.0625rem 0.25rem;
  font-weight: 600;
}

.approval-queue__actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
.approval-queue__btn {
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.approval-queue__btn--approve { background: #dcfce7; color: #15803d; }
.approval-queue__btn--approve:hover:not(:disabled) { background: #bbf7d0; }
.approval-queue__btn--approve:disabled { opacity: 0.4; cursor: not-allowed; }
.approval-queue__btn--deny { background: #fee2e2; color: #b91c1c; }
.approval-queue__btn--deny:hover { background: #fecaca; }
</style>

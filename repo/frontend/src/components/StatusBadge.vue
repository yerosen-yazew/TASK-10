<script setup lang="ts">
// REQ: R3 — MembershipState status pill badge for room member list

import { computed } from 'vue'
import { MembershipState } from '@/models/room'

const props = defineProps<{
  status: string
  size?: 'sm' | 'md'
}>()

const label = computed(() => {
  const labels: Record<string, string> = {
    [MembershipState.Active]: 'Active',
    [MembershipState.Requested]: 'Pending',
    [MembershipState.PendingSecondApproval]: 'Needs 2nd Approval',
    [MembershipState.Left]: 'Left',
    [MembershipState.Rejected]: 'Rejected',
    connected: 'Connected',
    connecting: 'Connecting',
    failed: 'Failed',
    idle: 'Idle',
  }
  return labels[props.status] ?? props.status
})

const colorClass = computed(() => {
  const map: Record<string, string> = {
    [MembershipState.Active]: 'status-badge--active',
    [MembershipState.Requested]: 'status-badge--pending',
    [MembershipState.PendingSecondApproval]: 'status-badge--pending',
    [MembershipState.Left]: 'status-badge--neutral',
    [MembershipState.Rejected]: 'status-badge--error',
    connected: 'status-badge--active',
    connecting: 'status-badge--pending',
    failed: 'status-badge--error',
  }
  return map[props.status] ?? 'status-badge--neutral'
})
</script>

<template>
  <span
    class="status-badge"
    :class="[colorClass, size === 'sm' ? 'status-badge--sm' : '']"
  >{{ label }}</span>
</template>

<style scoped>
.status-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
}
.status-badge--sm { font-size: 0.6875rem; padding: 0.0625rem 0.375rem; }
.status-badge--active   { background: #dcfce7; color: #15803d; }
.status-badge--pending  { background: #fef9c3; color: #854d0e; }
.status-badge--error    { background: #fee2e2; color: #b91c1c; }
.status-badge--neutral  { background: #f1f5f9; color: #475569; }
</style>

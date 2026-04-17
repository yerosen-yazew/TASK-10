// REQ: R1/R3/R4 — Thin harness exposing room + membership engine to UI

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Room, MemberRecord, JoinRequest } from '@/models/room'
import { MembershipState } from '@/models/room'
import * as roomEngine from '@/engine/room-engine'
import * as membershipEngine from '@/engine/membership-engine'
import { memberRepository } from '@/services/member-repository'
import { publishMembership } from '@/services/collab-publisher'
import { logger } from '@/utils/logger'

export const useRoomStore = defineStore('room', () => {
  const activeRoom = ref<Room | null>(null)
  const members = ref<MemberRecord[]>([])
  const isLoading = ref(false)
  const lastError = ref<string | null>(null)

  const activeMembers = computed(() =>
    members.value.filter((m) => m.state === MembershipState.Active)
  )
  const pendingMembers = computed(() =>
    members.value.filter(
      (m) =>
        m.state === MembershipState.Requested ||
        m.state === MembershipState.PendingSecondApproval
    )
  )

  async function loadRoom(roomId: string): Promise<void> {
    isLoading.value = true
    lastError.value = null
    try {
      const room = await roomEngine.getRoom(roomId)
      activeRoom.value = room ?? null
      members.value = await memberRepository.listByRoom(roomId)
    } catch (err) {
      logger.error('Failed to load room', { roomId, err })
      lastError.value = 'Failed to load room.'
    } finally {
      isLoading.value = false
    }
  }

  async function refreshMembers(): Promise<void> {
    if (!activeRoom.value) return
    members.value = await memberRepository.listByRoom(activeRoom.value.roomId)
  }

  async function requestJoin(request: JoinRequest) {
    const result = await membershipEngine.requestJoin(request.roomId, request)
    await refreshMembers()
    if (result.validation?.valid !== false) {
      publishMembership(
        request.roomId,
        'request',
        request.requesterId,
        request.requesterId,
        result.member
      )
    }
    return result
  }

  async function approveJoin(memberId: string, approver: membershipEngine.ApprovalActor) {
    if (!activeRoom.value) throw new Error('No active room.')
    const roomId = activeRoom.value.roomId
    const result = await membershipEngine.approveJoin(roomId, memberId, approver)
    await refreshMembers()
    if (result.validation?.valid !== false) {
      publishMembership(roomId, 'approve', memberId, approver.memberId, result.member)
    }
    return result
  }

  async function denyJoin(
    memberId: string,
    approver: membershipEngine.ApprovalActor,
    reason?: string
  ) {
    if (!activeRoom.value) throw new Error('No active room.')
    const roomId = activeRoom.value.roomId
    const result = await membershipEngine.denyJoin(
      roomId,
      memberId,
      approver,
      reason
    )
    await refreshMembers()
    if (result.validation?.valid !== false) {
      publishMembership(roomId, 'reject', memberId, approver.memberId, result.member)
    }
    return result
  }

  async function leave(memberId: string) {
    if (!activeRoom.value) throw new Error('No active room.')
    const roomId = activeRoom.value.roomId
    const result = await membershipEngine.leaveRoom(roomId, memberId)
    await refreshMembers()
    if (result.validation?.valid !== false) {
      publishMembership(roomId, 'leave', memberId, memberId, result.member)
    }
    return result
  }

  async function createRoom(input: roomEngine.CreateRoomInput) {
    const result = await roomEngine.createRoom(input)
    if (result.room) {
      activeRoom.value = result.room
      await refreshMembers()
    }
    return result
  }

  function clearError(): void {
    lastError.value = null
  }

  return {
    activeRoom,
    members,
    isLoading,
    lastError,
    activeMembers,
    pendingMembers,
    loadRoom,
    refreshMembers,
    requestJoin,
    approveJoin,
    denyJoin,
    leave,
    createRoom,
    clearError,
  }
})

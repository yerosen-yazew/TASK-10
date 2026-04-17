<script setup lang="ts">
// REQ: R8 — Chat panel: messages, composer, pin/unpin, retention notice

import { ref, computed, watch, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat-store'
import { useSessionStore } from '@/stores/session-store'
import { useRoomStore } from '@/stores/room-store'
import { useUiStore } from '@/stores/ui-store'
import { MAX_PINNED_MESSAGES, MAX_CHAT_MESSAGES_RETAINED } from '@/models/constants'
import { RoomRole } from '@/models/room'
import type { ActivityActor } from '@/engine/activity-engine'
import LimitIndicator from '@/components/LimitIndicator.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'

const RETENTION_WARNING_THRESHOLD = MAX_CHAT_MESSAGES_RETAINED - 100

const props = defineProps<{
  roomId: string
  actor: ActivityActor
  disabled?: boolean
}>()

const chatStore = useChatStore()
const sessionStore = useSessionStore()
const roomStore = useRoomStore()
const uiStore = useUiStore()

const messageText = ref('')
const messageListRef = ref<HTMLElement | null>(null)

const currentRole = computed<RoomRole | null>(() => {
  if (!sessionStore.activeProfileId) return null
  const member = roomStore.members.find((m) => m.memberId === sessionStore.activeProfileId)
  return member?.role ?? null
})

const canPin = computed(() =>
  currentRole.value === RoomRole.Host || currentRole.value === RoomRole.Reviewer
)

const atPinCap = computed(() => chatStore.pinned.length >= MAX_PINNED_MESSAGES)

const approachingRetention = computed(
  () => chatStore.messages.length >= RETENTION_WARNING_THRESHOLD
)

function isPinned(messageId: string): boolean {
  return chatStore.pinned.some((p) => p.messageId === messageId)
}

async function sendMessage(): Promise<void> {
  const text = messageText.value.trim()
  if (!text || props.disabled) return
  messageText.value = ''
  const result = await chatStore.sendMessage({
    roomId: props.roomId,
    authorId: props.actor.memberId,
    authorDisplayName: props.actor.displayName,
    text,
  })
  if (!result.validation.valid) {
    uiStore.toast.error(result.validation.errors[0]?.message ?? 'Failed to send message.')
  }
  await scrollToBottom()
}

async function pinMessage(messageId: string): Promise<void> {
  if (atPinCap.value) {
    uiStore.toast.warning(`Maximum ${MAX_PINNED_MESSAGES} pinned messages allowed.`)
    return
  }
  const result = await chatStore.pinMessage(props.roomId, messageId, props.actor)
  if (!result.validation.valid) {
    uiStore.toast.error(result.validation.errors[0]?.message ?? 'Pin failed.')
  }
}

async function unpinMessage(messageId: string): Promise<void> {
  const result = await chatStore.unpinMessage(props.roomId, messageId, props.actor)
  if (!result.valid) {
    uiStore.toast.error('Unpin failed.')
  }
}

async function scrollToBottom(): Promise<void> {
  await nextTick()
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

// Auto-scroll when messages change
watch(() => chatStore.messages.length, () => scrollToBottom())
</script>

<template>
  <div class="chat-panel">
    <!-- Pinned messages row -->
    <div v-if="chatStore.pinned.length > 0" class="chat-panel__pinned">
      <span class="chat-panel__pinned-label">📌 Pinned</span>
      <div class="chat-panel__pinned-list">
        <div
          v-for="pin in chatStore.pinned"
          :key="pin.messageId"
          class="chat-panel__pin-item"
        >
          <span class="chat-panel__pin-text">
            {{ chatStore.messages.find(m => m.messageId === pin.messageId)?.text ?? '(deleted)' }}
          </span>
          <button
            v-if="canPin"
            class="chat-panel__unpin-btn"
            title="Unpin"
            @click="unpinMessage(pin.messageId)"
          >×</button>
        </div>
      </div>
      <LimitIndicator
        :current="chatStore.pinned.length"
        :max="MAX_PINNED_MESSAGES"
        label="pinned"
        class="chat-panel__pin-limit"
      />
    </div>

    <!-- Retention approaching warning -->
    <div v-if="approachingRetention" class="chat-panel__retention-notice">
      ℹ Approaching 5,000 message limit — oldest messages will be removed.
    </div>

    <!-- Loading state -->
    <div v-if="chatStore.isLoading" class="chat-panel__loading">
      <LoadingSpinner size="sm" />
    </div>

    <!-- Messages list -->
    <div
      v-else
      ref="messageListRef"
      class="chat-panel__messages"
    >
      <EmptyState
        v-if="chatStore.messages.length === 0"
        icon="💬"
        title="No messages yet"
        description="Start the conversation."
      />

      <div
        v-for="msg in chatStore.messages.filter(m => !m.isDeleted)"
        :key="msg.messageId"
        class="chat-panel__message"
        :class="{ 'chat-panel__message--own': msg.authorId === actor.memberId }"
      >
        <div class="chat-panel__message-meta">
          <span class="chat-panel__author">{{ msg.authorDisplayName }}</span>
          <span class="chat-panel__time">{{ formatTime(msg.createdAt) }}</span>
          <!-- Pin button (Host/Reviewer only, when not at cap) -->
          <button
            v-if="canPin && !isPinned(msg.messageId)"
            class="chat-panel__pin-btn"
            :data-testid="`pin-btn-${msg.messageId}`"
            :disabled="atPinCap"
            :title="atPinCap ? `${MAX_PINNED_MESSAGES} pinned messages (max)` : 'Pin'"
            @click="pinMessage(msg.messageId)"
          >📌</button>
        </div>
        <p class="chat-panel__text">{{ msg.text }}</p>
      </div>
    </div>

    <!-- Composer -->
    <div class="chat-panel__composer" :class="{ 'chat-panel__composer--disabled': disabled }">
      <textarea
        v-model="messageText"
        class="chat-panel__input"
        placeholder="Message… (Enter to send)"
        rows="2"
        :disabled="disabled || chatStore.isLoading"
        @keydown="onKeyDown"
      />
      <button
        class="chat-panel__send"
        data-testid="send-btn"
        :disabled="!messageText.trim() || disabled || chatStore.isLoading"
        @click="sendMessage"
      >
        Send
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.chat-panel__pinned {
  padding: 0.375rem 0.75rem;
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
  flex-shrink: 0;
}

.chat-panel__pinned-label {
  font-size: 0.6875rem;
  font-weight: 700;
  color: #92400e;
  display: block;
  margin-bottom: 0.25rem;
}

.chat-panel__pinned-list { display: flex; flex-direction: column; gap: 0.125rem; }

.chat-panel__pin-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.chat-panel__pin-text {
  font-size: 0.75rem;
  color: #78350f;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-panel__unpin-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #92400e;
  font-size: 0.875rem;
  padding: 0;
  line-height: 1;
}

.chat-panel__pin-limit { margin-top: 0.25rem; }

.chat-panel__retention-notice {
  padding: 0.375rem 0.75rem;
  background: #eff6ff;
  border-bottom: 1px solid #bfdbfe;
  font-size: 0.75rem;
  color: #1d4ed8;
  flex-shrink: 0;
}

.chat-panel__loading {
  display: flex;
  justify-content: center;
  padding: 1.5rem;
  flex: 1;
}

.chat-panel__messages {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.chat-panel__message {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.chat-panel__message--own .chat-panel__message-meta { flex-direction: row-reverse; }
.chat-panel__message--own .chat-panel__text {
  text-align: right;
  background: #dbeafe;
  align-self: flex-end;
}

.chat-panel__message-meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.chat-panel__author {
  font-size: 0.6875rem;
  font-weight: 600;
  color: #475569;
}

.chat-panel__time {
  font-size: 0.625rem;
  color: #94a3b8;
}

.chat-panel__pin-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.625rem;
  padding: 0;
  opacity: 0.5;
}
.chat-panel__pin-btn:hover:not(:disabled) { opacity: 1; }
.chat-panel__pin-btn:disabled { opacity: 0.2; cursor: not-allowed; }

.chat-panel__text {
  margin: 0;
  padding: 0.375rem 0.5rem;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: #1e293b;
  line-height: 1.4;
  word-break: break-word;
  align-self: flex-start;
}

.chat-panel__composer {
  flex-shrink: 0;
  display: flex;
  gap: 0.375rem;
  padding: 0.5rem;
  border-top: 1px solid #e2e8f0;
}

.chat-panel__composer--disabled { opacity: 0.5; }

.chat-panel__input {
  flex: 1;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.375rem 0.5rem;
  font-size: 0.8125rem;
  font-family: inherit;
  resize: none;
  line-height: 1.4;
}
.chat-panel__input:focus { outline: none; border-color: #2563eb; }
.chat-panel__input:disabled { background: #f8fafc; }

.chat-panel__send {
  padding: 0.375rem 0.75rem;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  cursor: pointer;
  align-self: flex-end;
  flex-shrink: 0;
}
.chat-panel__send:hover:not(:disabled) { background: #1d4ed8; }
.chat-panel__send:disabled { background: #93c5fd; cursor: not-allowed; }
</style>

<script setup lang="ts">
// REQ: R19 — WebRTC manual pairing panel: offer/answer exchange, copy-paste, QR fallback

import { ref, computed } from 'vue'
import { usePeersStore } from '@/stores/peers-store'
import { useSessionStore } from '@/stores/session-store'
import { useUiStore } from '@/stores/ui-store'
import {
  createOffer,
  addRemoteOffer,
  acceptAnswer,
  generatePeerId,
} from '@/services/webrtc-peer-service'

const props = defineProps<{
  roomId: string
  isHost: boolean
}>()

const peersStore = usePeersStore()
const sessionStore = useSessionStore()
const uiStore = useUiStore()

const answerInput = ref('')
const remoteOfferInput = ref('')
const localPeerId = ref(generatePeerId())

const statusLabel = computed((): string => {
  const map: Record<string, string> = {
    idle: 'Not connected',
    generating: 'Generating offer…',
    'awaiting-answer': 'Waiting for answer',
    connecting: 'Connecting…',
    connected: 'Connected',
    failed: 'Connection failed',
  }
  return map[peersStore.pairingStep] ?? peersStore.pairingStep
})

const statusColor = computed((): string => {
  if (peersStore.pairingStep === 'connected') return '#15803d'
  if (peersStore.pairingStep === 'failed') return '#b91c1c'
  if (peersStore.pairingStep === 'awaiting-answer' || peersStore.pairingStep === 'connecting') return '#854d0e'
  return '#475569'
})

async function generateOffer(): Promise<void> {
  peersStore.setPairingStep('generating')
  peersStore.setPairingError(null)
  try {
    const offer = await createOffer(
      props.roomId,
      localPeerId.value,
      sessionStore.activeProfile?.displayName ?? 'Host'
    )
    peersStore.setLocalOffer(offer)
    peersStore.setPairingStep('awaiting-answer')
  } catch (err) {
    peersStore.setPairingError(err instanceof Error ? err.message : 'Failed to generate offer.')
    peersStore.setPairingStep('failed')
  }
}

async function applyAnswer(): Promise<void> {
  const answer = answerInput.value.trim()
  if (!answer) return
  peersStore.setPairingStep('connecting')
  try {
    await acceptAnswer(localPeerId.value, answer)
    peersStore.setPairingStep('connected')
    uiStore.toast.success('Peer connected!')
  } catch (err) {
    peersStore.setPairingError(err instanceof Error ? err.message : 'Failed to apply answer.')
    peersStore.setPairingStep('failed')
    uiStore.toast.error('Connection failed. Check the pasted answer.')
  }
}

async function generateAnswer(): Promise<void> {
  const offer = remoteOfferInput.value.trim()
  if (!offer) return
  peersStore.setPairingStep('connecting')
  try {
    const answer = await addRemoteOffer(
      offer,
      localPeerId.value,
      sessionStore.activeProfile?.displayName ?? 'Guest'
    )
    peersStore.setLocalAnswer(answer)
    peersStore.setPairingStep('awaiting-answer')
  } catch (err) {
    peersStore.setPairingError(err instanceof Error ? err.message : 'Failed to generate answer.')
    peersStore.setPairingStep('failed')
    uiStore.toast.error('Invalid offer. Please re-paste from the host.')
  }
}

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text).then(
    () => uiStore.toast.success('Copied to clipboard.'),
    () => uiStore.toast.warning('Copy failed — please select and copy manually.')
  )
}

function retryPairing(): void {
  peersStore.resetPairing()
  localPeerId.value = generatePeerId()
  answerInput.value = ''
  remoteOfferInput.value = ''
}
</script>

<template>
  <div class="pairing-panel">
    <div class="pairing-panel__status">
      <span class="pairing-panel__status-dot" :style="{ background: statusColor }" />
      <span class="pairing-panel__status-label" :style="{ color: statusColor }">{{ statusLabel }}</span>
    </div>

    <p v-if="peersStore.pairingError" class="pairing-panel__error">
      {{ peersStore.pairingError }}
    </p>

    <!-- Host flow: generate offer → paste answer -->
    <template v-if="isHost">
      <div v-if="!peersStore.localOffer" class="pairing-panel__section">
        <p class="pairing-panel__desc">
          Generate a pairing offer, then share it with the peer you want to connect.
        </p>
        <button
          class="pairing-panel__btn pairing-panel__btn--primary"
          :disabled="peersStore.pairingStep === 'generating'"
          @click="generateOffer"
        >
          {{ peersStore.pairingStep === 'generating' ? 'Generating…' : 'Generate Offer' }}
        </button>
      </div>

      <div v-else class="pairing-panel__section">
        <label class="pairing-panel__label">Your Offer (share with peer)</label>
        <textarea
          class="pairing-panel__textarea pairing-panel__textarea--readonly"
          :value="peersStore.localOffer"
          readonly
          rows="4"
        />
        <button class="pairing-panel__btn" @click="copyToClipboard(peersStore.localOffer!)">
          Copy Offer
        </button>

        <label class="pairing-panel__label" style="margin-top: 1rem">
          Paste Answer from Peer
        </label>
        <textarea
          v-model="answerInput"
          class="pairing-panel__textarea"
          placeholder="Paste the answer here…"
          rows="4"
        />
        <button
          class="pairing-panel__btn pairing-panel__btn--primary"
          :disabled="!answerInput.trim() || peersStore.pairingStep === 'connecting'"
          @click="applyAnswer"
        >
          Connect
        </button>
      </div>
    </template>

    <!-- Guest/joiner flow: paste offer → copy answer -->
    <template v-else>
      <div v-if="!peersStore.localAnswer" class="pairing-panel__section">
        <label class="pairing-panel__label">Paste Host's Offer</label>
        <textarea
          v-model="remoteOfferInput"
          class="pairing-panel__textarea"
          placeholder="Paste the offer from the host…"
          rows="4"
        />
        <button
          class="pairing-panel__btn pairing-panel__btn--primary"
          :disabled="!remoteOfferInput.trim() || peersStore.pairingStep === 'connecting'"
          @click="generateAnswer"
        >
          {{ peersStore.pairingStep === 'connecting' ? 'Generating Answer…' : 'Generate Answer' }}
        </button>
      </div>

      <div v-else class="pairing-panel__section">
        <label class="pairing-panel__label">Your Answer (send back to host)</label>
        <textarea
          class="pairing-panel__textarea pairing-panel__textarea--readonly"
          :value="peersStore.localAnswer"
          readonly
          rows="4"
        />
        <button class="pairing-panel__btn" @click="copyToClipboard(peersStore.localAnswer!)">
          Copy Answer
        </button>
        <p class="pairing-panel__hint">
          Share this answer with the host to complete the connection.
        </p>
      </div>
    </template>

    <!-- Failure fallback guidance -->
    <div v-if="peersStore.pairingStep === 'failed'" class="pairing-panel__fallback" data-testid="fallback-guidance">
      <p class="pairing-panel__fallback-title">Connection failed — fallback options:</p>
      <ul class="pairing-panel__fallback-list">
        <li>Export a room backup and share the <code>.json</code> file with the other device.</li>
        <li>The other device can import the backup via <strong>Backup &amp; Restore</strong>.</li>
        <li>Both users will then have the same room state and can work independently.</li>
      </ul>
      <button class="pairing-panel__btn" data-testid="retry-btn" @click="retryPairing">
        Try Again
      </button>
    </div>

    <p class="pairing-panel__disclaimer">
      Pairing uses manual copy/paste only — no signaling server involved.
      If connection fails, use Backup &amp; Restore to share room state.
    </p>
  </div>
</template>

<style scoped>
.pairing-panel {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pairing-panel__status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pairing-panel__status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  flex-shrink: 0;
}

.pairing-panel__status-label { font-size: 0.8125rem; font-weight: 600; }

.pairing-panel__error {
  font-size: 0.8125rem;
  color: #dc2626;
  background: #fee2e2;
  border-radius: 4px;
  padding: 0.375rem 0.5rem;
  margin: 0;
}

.pairing-panel__section { display: flex; flex-direction: column; gap: 0.375rem; }

.pairing-panel__desc { font-size: 0.8125rem; color: #475569; margin: 0; }

.pairing-panel__label { font-size: 0.75rem; font-weight: 600; color: #334155; }

.pairing-panel__textarea {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  font-family: monospace;
  resize: vertical;
  box-sizing: border-box;
}
.pairing-panel__textarea:focus { outline: none; border-color: #2563eb; }
.pairing-panel__textarea--readonly { background: #f8fafc; color: #475569; }

.pairing-panel__btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  color: #1e293b;
}
.pairing-panel__btn:hover:not(:disabled) { background: #e2e8f0; }
.pairing-panel__btn:disabled { opacity: 0.4; cursor: not-allowed; }
.pairing-panel__btn--primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.pairing-panel__btn--primary:hover:not(:disabled) { background: #1d4ed8; }

.pairing-panel__hint { font-size: 0.75rem; color: #64748b; margin: 0; }

.pairing-panel__fallback {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pairing-panel__fallback-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #b91c1c;
  margin: 0;
}

.pairing-panel__fallback-list {
  font-size: 0.8125rem;
  color: #7f1d1d;
  padding-left: 1.25rem;
  margin: 0;
  line-height: 1.6;
}

.pairing-panel__disclaimer {
  font-size: 0.6875rem;
  color: #94a3b8;
  margin: 0;
  font-style: italic;
}
</style>

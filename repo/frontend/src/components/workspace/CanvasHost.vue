<script setup lang="ts">
// REQ: R5 — Canvas host: pointer events, element overlays, tool interactions
// REQ: R6 — Element cap enforcement at interaction level
// Uses an overlay renderer (SVG/div) for interactive whiteboard editing and image display.

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useElementStore } from '@/stores/element-store'
import { useCommentStore } from '@/stores/comment-store'
import { useSessionStore } from '@/stores/session-store'
import { useUiStore } from '@/stores/ui-store'
import { MAX_ELEMENTS_PER_ROOM, MAX_IMAGE_SIZE_BYTES, MAX_IMAGES_PER_ROOM } from '@/models/constants'
import { ElementType } from '@/models/element'
import type { WhiteboardElement, StickyNote, Arrow, PenStroke, ImageElement } from '@/models/element'
import type { ToolType } from '@/stores/preferences-store'
import type { ActivityActor } from '@/engine/activity-engine'
import LimitIndicator from '@/components/LimitIndicator.vue'
import { imageBlobRepository } from '@/services/image-blob-repository'

const props = defineProps<{
  roomId: string
  activeTool: ToolType
  actor: ActivityActor
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'element-selected', elementId: string | null): void
  (e: 'tool-used'): void
  (e: 'open-comments', elementId: string): void
  (e: 'cursor-move', position: { x: number; y: number }): void
}>()

let rafToken = 0

const elementStore = useElementStore()
const sessionStore = useSessionStore()
const uiStore = useUiStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const hostRef = ref<HTMLDivElement | null>(null)

// ── Sticky note editor state ────────────────────────────────────────────────
const showStickyEditor = ref(false)
const stickyEditorPos = ref({ x: 0, y: 0 })
const stickyText = ref('')
const stickyColor = ref('#fef9c3')
const STICKY_COLORS = ['#fef9c3', '#dcfce7', '#dbeafe', '#fce7f3', '#e0e7ff', '#ffedd5']

// ── Arrow drawing state ─────────────────────────────────────────────────────
const arrowStart = ref<{ x: number; y: number } | null>(null)
const arrowEnd = ref<{ x: number; y: number } | null>(null)
const isDrawingArrow = ref(false)

// ── Pen drawing state ───────────────────────────────────────────────────────
const penPoints = ref<Array<{ x: number; y: number; pressure: number; timestamp: number }>>([])
const isDrawingPen = ref(false)

// ── Selection state ─────────────────────────────────────────────────────────
const selectedElementId = ref<string | null>(null)
const imageObjectUrls = ref<Record<string, string>>({})
const failedImageIds = ref<Record<string, true>>({})

const atElementCap = computed(() => elementStore.elements.length >= MAX_ELEMENTS_PER_ROOM)
const imageElements = computed(() =>
  elementStore.elements.filter((e) => e.type === ElementType.Image) as ImageElement[]
)
const atImageCap = computed(() => imageElements.value.length >= MAX_IMAGES_PER_ROOM)

function revokeImageUrl(imageId: string): void {
  const url = imageObjectUrls.value[imageId]
  if (url) {
    URL.revokeObjectURL(url)
    const next = { ...imageObjectUrls.value }
    delete next[imageId]
    imageObjectUrls.value = next
  }
}

function clearImageUrls(): void {
  for (const imageId of Object.keys(imageObjectUrls.value)) {
    URL.revokeObjectURL(imageObjectUrls.value[imageId])
  }
  imageObjectUrls.value = {}
}

async function syncImageObjectUrls(): Promise<void> {
  const activeImageIds = new Set(imageElements.value.map((el) => el.imageId))

  // Revoke stale URLs no longer present in the room.
  for (const imageId of Object.keys(imageObjectUrls.value)) {
    if (!activeImageIds.has(imageId)) revokeImageUrl(imageId)
  }

  // Resolve missing image blobs.
  for (const element of imageElements.value) {
    const imageId = element.imageId
    if (imageObjectUrls.value[imageId] || failedImageIds.value[imageId]) continue
    try {
      const record = await imageBlobRepository.getById(imageId)
      if (!record) {
        failedImageIds.value = { ...failedImageIds.value, [imageId]: true }
        continue
      }
      imageObjectUrls.value = {
        ...imageObjectUrls.value,
        [imageId]: URL.createObjectURL(record.blob),
      }
    } catch {
      failedImageIds.value = { ...failedImageIds.value, [imageId]: true }
    }
  }
}

function getCanvasOffset(event: PointerEvent | DragEvent): { x: number; y: number } {
  const rect = hostRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  return {
    x: ('clientX' in event ? event.clientX : 0) - rect.left,
    y: ('clientY' in event ? event.clientY : 0) - rect.top,
  }
}

// ── Double-click: open sticky note editor ──────────────────────────────────
function onDblClick(event: MouseEvent) {
  if (props.disabled || props.activeTool !== 'sticky') return
  if (atElementCap.value) {
    uiStore.toast.warning(`Element limit reached (${MAX_ELEMENTS_PER_ROOM} max).`)
    return
  }
  const rect = hostRef.value?.getBoundingClientRect()
  if (!rect) return
  stickyEditorPos.value = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  stickyText.value = ''
  stickyColor.value = '#fef9c3'
  showStickyEditor.value = true
}

async function confirmSticky() {
  if (!stickyText.value.trim()) {
    showStickyEditor.value = false
    return
  }
  const result = await elementStore.createSticky({
    roomId: props.roomId,
    position: stickyEditorPos.value,
    dimensions: { width: 160, height: 120 },
    text: stickyText.value.trim(),
    backgroundColor: stickyColor.value,
    textColor: '#1e293b',
    fontSize: 14,
    actor: props.actor,
  })
  showStickyEditor.value = false
  if (!result.validation.valid) {
    uiStore.toast.error(result.validation.errors[0]?.message ?? 'Failed to create sticky note.')
  } else {
    emit('tool-used')
  }
}

// ── Pointer down ─────────────────────────────────────────────────────────────
function onPointerDown(event: PointerEvent) {
  if (props.disabled) return
  const pos = getCanvasOffset(event)

  if (props.activeTool === 'arrow' && !isDrawingArrow.value) {
    if (atElementCap.value) {
      uiStore.toast.warning(`Element limit reached (${MAX_ELEMENTS_PER_ROOM} max).`)
      return
    }
    arrowStart.value = pos
    arrowEnd.value = pos
    isDrawingArrow.value = true
    ;(event.target as HTMLElement)?.setPointerCapture?.(event.pointerId)
  }

  if (props.activeTool === 'pen' && !isDrawingPen.value) {
    if (atElementCap.value) {
      uiStore.toast.warning(`Element limit reached (${MAX_ELEMENTS_PER_ROOM} max).`)
      return
    }
    penPoints.value = [{ x: pos.x, y: pos.y, pressure: event.pressure ?? 0.5, timestamp: Date.now() }]
    isDrawingPen.value = true
    ;(event.target as HTMLElement)?.setPointerCapture?.(event.pointerId)
  }
}

// ── Pointer move ─────────────────────────────────────────────────────────────
function onPointerMove(event: PointerEvent) {
  if (props.disabled) return
  const pos = getCanvasOffset(event)

  if (isDrawingArrow.value) {
    arrowEnd.value = pos
  }

  if (isDrawingPen.value) {
    penPoints.value.push({ x: pos.x, y: pos.y, pressure: event.pressure ?? 0.5, timestamp: Date.now() })
  }

  // Throttle presence cursor updates with requestAnimationFrame
  if (rafToken === 0) {
    const raf = (typeof window !== 'undefined' && window.requestAnimationFrame)
      ? window.requestAnimationFrame
      : (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number
    rafToken = raf(() => {
      rafToken = 0
      emit('cursor-move', { x: pos.x, y: pos.y })
    })
  }
}

// ── Pointer up ──────────────────────────────────────────────────────────────
async function onPointerUp(event: PointerEvent) {
  if (props.disabled) return

  if (isDrawingArrow.value && arrowStart.value && arrowEnd.value) {
    isDrawingArrow.value = false
    const start = { ...arrowStart.value }
    const end = { ...arrowEnd.value }
    arrowStart.value = null
    arrowEnd.value = null

    const dx = end.x - start.x
    const dy = end.y - start.y
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      const result = await elementStore.createArrow({
        roomId: props.roomId,
        position: start,
        startPoint: start,
        endPoint: end,
        strokeColor: '#1e293b',
        strokeWidth: 2,
        arrowHeadStyle: 'triangle',
        actor: props.actor,
      })
      if (!result.validation.valid) {
        uiStore.toast.error(result.validation.errors[0]?.message ?? 'Failed to create arrow.')
      } else {
        emit('tool-used')
      }
    }
  }

  if (isDrawingPen.value && penPoints.value.length > 2) {
    isDrawingPen.value = false
    const points = penPoints.value.splice(0)
    const result = await elementStore.createPenStroke({
      roomId: props.roomId,
      position: points[0] ?? { x: 0, y: 0 },
      points: points.map((p) => ({ x: p.x, y: p.y, pressure: p.pressure, timestamp: p.timestamp })),
      strokeColor: '#1e293b',
      strokeWidth: 2,
      actor: props.actor,
    })
    if (!result.validation.valid) {
      uiStore.toast.error(result.validation.errors[0]?.message ?? 'Failed to create pen stroke.')
    } else {
      emit('tool-used')
    }
  }
}

// ── Image drop ───────────────────────────────────────────────────────────────
function onDragOver(event: DragEvent) {
  event.preventDefault()
  if (props.activeTool === 'image' || props.activeTool === 'select') {
    event.dataTransfer!.dropEffect = 'copy'
  }
}

async function onDrop(event: DragEvent) {
  event.preventDefault()
  if (props.disabled) return
  const files = Array.from(event.dataTransfer?.files ?? [])
  const imageFile = files.find((f) => f.type.startsWith('image/'))
  if (!imageFile) return

  if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
    uiStore.toast.error(`Image exceeds 5 MB limit (${(imageFile.size / 1024 / 1024).toFixed(1)} MB).`)
    return
  }
  if (atImageCap.value) {
    uiStore.toast.error(`Image limit reached (${MAX_IMAGES_PER_ROOM} per room).`)
    return
  }
  if (atElementCap.value) {
    uiStore.toast.error(`Element limit reached (${MAX_ELEMENTS_PER_ROOM} max).`)
    return
  }

  const pos = getCanvasOffset(event)
  const dimensions = await readImageDimensions(imageFile)
  const result = await elementStore.ingestImage({
    roomId: props.roomId,
    blob: imageFile,
    fileName: imageFile.name,
    mimeType: imageFile.type,
    position: pos,
    dimensions,
    actor: props.actor,
  })
  if (!result.validation.valid) {
    uiStore.toast.error(result.validation.errors[0]?.message ?? 'Failed to add image.')
  } else {
    emit('tool-used')
  }
}

async function readImageDimensions(file: Blob): Promise<{ width: number; height: number }> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file)
      const out = { width: bitmap.width, height: bitmap.height }
      if (typeof (bitmap as ImageBitmap).close === 'function') (bitmap as ImageBitmap).close()
      return out
    }
  } catch {
    // fall through to default
  }
  return { width: 200, height: 200 }
}

// ── Element selection ────────────────────────────────────────────────────────
function selectElement(id: string) {
  selectedElementId.value = id
  emit('element-selected', id)
}

function clearSelection() {
  selectedElementId.value = null
  emit('element-selected', null)
}

async function deleteSelected() {
  if (!selectedElementId.value) return
  const result = await elementStore.deleteElement(selectedElementId.value, props.actor)
  if (!result.validation.valid) {
    uiStore.toast.error(result.validation.errors[0]?.message ?? 'Delete failed.')
  } else {
    clearSelection()
  }
}

async function bringToFront() {
  if (!selectedElementId.value) return
  await elementStore.bringToFront(selectedElementId.value, props.actor)
}

// SVG path helper for pen strokes
function penPath(points: typeof penPoints.value): string {
  if (points.length < 2) return ''
  return points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`
  }, '')
}

// Key handler for delete key
function onKeyDown(event: KeyboardEvent) {
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedElementId.value) {
    deleteSelected()
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onMounted(() => {
  void syncImageObjectUrls()
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  clearImageUrls()
})

watch(
  () => imageElements.value.map((el) => el.imageId),
  () => {
    void syncImageObjectUrls()
  },
  { deep: true }
)
</script>

<template>
  <div
    ref="hostRef"
    class="canvas-host"
    :class="{ 'canvas-host--disabled': disabled }"
    tabindex="0"
    @dblclick="onDblClick"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @dragover="onDragOver"
    @drop="onDrop"
    @click.self="clearSelection"
  >
    <!-- Underlying canvas element (full rendering deferred) -->
    <canvas ref="canvasRef" class="canvas-host__canvas" />

    <!-- SVG overlay for in-progress arrow drawing -->
    <svg class="canvas-host__svg-overlay" v-if="isDrawingArrow && arrowStart && arrowEnd">
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#1e293b" />
        </marker>
      </defs>
      <line
        :x1="arrowStart.x" :y1="arrowStart.y"
        :x2="arrowEnd.x" :y2="arrowEnd.y"
        stroke="#1e293b" stroke-width="2"
        marker-end="url(#arrowhead)"
      />
    </svg>

    <!-- SVG overlay for in-progress pen stroke -->
    <svg class="canvas-host__svg-overlay" v-if="isDrawingPen && penPoints.length > 1">
      <path :d="penPath(penPoints)" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round" />
    </svg>

    <!-- Element overlays -->
    <template v-for="el in elementStore.elements" :key="el.elementId">
      <!-- Sticky notes -->
      <div
        v-if="el.type === ElementType.StickyNote"
        class="canvas-host__sticky"
        :class="{ 'canvas-host__sticky--selected': selectedElementId === el.elementId }"
        :style="{
          left: (el as StickyNote).position.x + 'px',
          top: (el as StickyNote).position.y + 'px',
          width: (el as StickyNote).dimensions.width + 'px',
          minHeight: (el as StickyNote).dimensions.height + 'px',
          background: (el as StickyNote).backgroundColor,
          color: (el as StickyNote).textColor,
          fontSize: (el as StickyNote).fontSize + 'px',
          zIndex: el.zIndex,
        }"
        @click.stop="selectElement(el.elementId)"
      >
        {{ (el as StickyNote).text }}
      </div>

      <!-- Arrows -->
      <svg
        v-else-if="el.type === ElementType.Arrow"
        class="canvas-host__svg-overlay canvas-host__svg-overlay--element"
        :style="{ zIndex: el.zIndex }"
        @click.stop="selectElement(el.elementId)"
      >
        <defs>
          <marker :id="`ah-${el.elementId}`" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" :fill="(el as Arrow).strokeColor" />
          </marker>
        </defs>
        <line
          :x1="(el as Arrow).startPoint.x" :y1="(el as Arrow).startPoint.y"
          :x2="(el as Arrow).endPoint.x" :y2="(el as Arrow).endPoint.y"
          :stroke="(el as Arrow).strokeColor"
          :stroke-width="(el as Arrow).strokeWidth"
          :marker-end="(el as Arrow).arrowHeadStyle !== 'none' ? `url(#ah-${el.elementId})` : undefined"
          :class="{ 'canvas-host__element--selected': selectedElementId === el.elementId }"
        />
      </svg>

      <!-- Pen strokes -->
      <svg
        v-else-if="el.type === ElementType.PenStroke"
        class="canvas-host__svg-overlay canvas-host__svg-overlay--element"
        :style="{ zIndex: el.zIndex }"
        @click.stop="selectElement(el.elementId)"
      >
        <path
          :d="penPath((el as PenStroke).points)"
          :stroke="(el as PenStroke).strokeColor"
          :stroke-width="(el as PenStroke).strokeWidth"
          fill="none"
          stroke-linecap="round"
          :class="{ 'canvas-host__element--selected': selectedElementId === el.elementId }"
        />
      </svg>

      <!-- Image placeholders -->
      <div
        v-else-if="el.type === ElementType.Image"
        class="canvas-host__image-card"
        :class="{ 'canvas-host__sticky--selected': selectedElementId === el.elementId }"
        :style="{
          left: el.position.x + 'px',
          top: el.position.y + 'px',
          width: (el as ImageElement).dimensions.width + 'px',
          height: (el as ImageElement).dimensions.height + 'px',
          zIndex: el.zIndex,
        }"
        :title="(el as ImageElement).fileName"
        @click.stop="selectElement(el.elementId)"
      >
        <img
          v-if="imageObjectUrls[(el as ImageElement).imageId]"
          class="canvas-host__image"
          :src="imageObjectUrls[(el as ImageElement).imageId]"
          :alt="(el as ImageElement).alt"
          draggable="false"
        />
        <div v-else class="canvas-host__image-placeholder">
          🖼 {{ (el as ImageElement).fileName }}
        </div>
      </div>
    </template>

    <!-- Selection action bar -->
    <div
      v-if="selectedElementId"
      class="canvas-host__action-bar"
    >
      <button class="canvas-host__action-btn" title="Bring to front" @click="bringToFront">↑ Front</button>
      <button class="canvas-host__action-btn canvas-host__action-btn--danger" title="Delete" @click="deleteSelected">Delete</button>
      <button
        class="canvas-host__action-btn"
        data-testid="canvas-comment-btn"
        title="Add comment"
        @click="selectedElementId && emit('open-comments', selectedElementId)"
      >Comment</button>
    </div>

    <!-- Sticky note editor modal -->
    <div
      v-if="showStickyEditor"
      class="canvas-host__sticky-editor"
      :style="{ left: stickyEditorPos.x + 'px', top: stickyEditorPos.y + 'px' }"
      @click.stop
    >
      <textarea
        v-model="stickyText"
        class="canvas-host__sticky-textarea"
        placeholder="Note text…"
        rows="4"
        autofocus
      />
      <div class="canvas-host__sticky-colors">
        <button
          v-for="color in STICKY_COLORS"
          :key="color"
          class="canvas-host__color-swatch"
          :class="{ 'canvas-host__color-swatch--active': stickyColor === color }"
          :style="{ background: color }"
          @click="stickyColor = color"
        />
      </div>
      <div class="canvas-host__sticky-actions">
        <button class="canvas-host__sticky-confirm" @click="confirmSticky">Add</button>
        <button class="canvas-host__sticky-cancel" @click="showStickyEditor = false">Cancel</button>
      </div>
    </div>

    <!-- Cap warning overlay (when element cap reached) -->
    <div v-if="atElementCap" class="canvas-host__cap-banner">
      <LimitIndicator :current="elementStore.elements.length" :max="MAX_ELEMENTS_PER_ROOM" label="elements" />
      <span>Element limit reached — delete items to add more.</span>
    </div>

    <!-- Disabled overlay for left members -->
    <div v-if="disabled" class="canvas-host__disabled-overlay" />
  </div>
</template>

<style scoped>
.canvas-host {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: default;
  background: #f8fafc;
  background-image:
    radial-gradient(circle, #d1d5db 1px, transparent 1px);
  background-size: 24px 24px;
}

.canvas-host:focus { outline: none; }
.canvas-host--disabled { cursor: not-allowed; }

.canvas-host__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.canvas-host__svg-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.canvas-host__svg-overlay--element { pointer-events: all; cursor: pointer; }

.canvas-host__sticky {
  position: absolute;
  padding: 0.5rem;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
  cursor: pointer;
  user-select: none;
  word-break: break-word;
  font-size: 0.875rem;
  line-height: 1.4;
  min-width: 80px;
}
.canvas-host__sticky--selected {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.canvas-host__image-card {
  position: absolute;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
}

.canvas-host__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  user-select: none;
  pointer-events: none;
}

.canvas-host__image-placeholder {
  width: 100%;
  height: 100%;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: #475569;
  user-select: none;
  padding: 0.25rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.canvas-host__element--selected { outline: 2px solid #2563eb; }

.canvas-host__action-bar {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.375rem;
  background: #1e293b;
  border-radius: 6px;
  padding: 0.375rem 0.625rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  z-index: 100;
}

.canvas-host__action-btn {
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  background: rgba(255,255,255,0.15);
  border: none;
  border-radius: 4px;
  color: #e2e8f0;
  cursor: pointer;
}
.canvas-host__action-btn:hover { background: rgba(255,255,255,0.25); }
.canvas-host__action-btn--danger { color: #fca5a5; }
.canvas-host__action-btn--danger:hover { background: rgba(220,38,38,0.3); }

.canvas-host__sticky-editor {
  position: absolute;
  z-index: 200;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.75rem;
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  width: 200px;
}

.canvas-host__sticky-textarea {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 0.375rem;
  font-size: 0.875rem;
  resize: none;
  font-family: inherit;
  box-sizing: border-box;
}
.canvas-host__sticky-textarea:focus { outline: none; border-color: #2563eb; }

.canvas-host__sticky-colors {
  display: flex;
  gap: 0.25rem;
  margin: 0.5rem 0;
}

.canvas-host__color-swatch {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}
.canvas-host__color-swatch--active { border-color: #2563eb; }

.canvas-host__sticky-actions {
  display: flex;
  gap: 0.375rem;
  justify-content: flex-end;
}

.canvas-host__sticky-confirm {
  padding: 0.25rem 0.625rem;
  font-size: 0.8125rem;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.canvas-host__sticky-confirm:hover { background: #1d4ed8; }

.canvas-host__sticky-cancel {
  padding: 0.25rem 0.625rem;
  font-size: 0.8125rem;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  cursor: pointer;
}

.canvas-host__cap-banner {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(254, 226, 226, 0.95);
  border-top: 1px solid #fecaca;
  padding: 0.375rem 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8125rem;
  color: #b91c1c;
  z-index: 50;
}

.canvas-host__disabled-overlay {
  position: absolute;
  inset: 0;
  background: rgba(248, 250, 252, 0.6);
  z-index: 10;
  pointer-events: all;
  cursor: not-allowed;
}
</style>

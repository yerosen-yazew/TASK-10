<script setup lang="ts">
// REQ: R5/R7/R8/R9/R10 — Workspace outer shell: sidebar + canvas + right panels

import { ref } from 'vue'

defineProps<{
  roomName?: string
}>()

const rightPanel = ref<'chat' | 'activity' | 'members' | 'snapshots' | null>('chat')
const showMemberSidebar = ref(false)

function togglePanel(panel: 'chat' | 'activity' | 'members' | 'snapshots') {
  rightPanel.value = rightPanel.value === panel ? null : panel
}

function openPanel(panel: 'chat' | 'activity' | 'members' | 'snapshots'): void {
  rightPanel.value = panel
}

defineExpose({ openPanel })
</script>

<template>
  <div class="workspace-layout">
    <!-- Left tool sidebar -->
    <div class="workspace-layout__left">
      <slot name="tool-sidebar" />
    </div>

    <!-- Main canvas area -->
    <div class="workspace-layout__main">
      <!-- Toolbar strip -->
      <div class="workspace-layout__toolbar">
        <slot name="toolbar" :togglePanel="togglePanel" :rightPanel="rightPanel" />
      </div>

      <!-- Canvas host -->
      <div class="workspace-layout__canvas">
        <slot name="canvas" />
      </div>
    </div>

    <!-- Right panel (contextual) -->
    <transition name="panel-slide">
      <div v-if="rightPanel" class="workspace-layout__right">
        <div class="workspace-layout__right-header">
          <div class="workspace-layout__right-tabs">
            <button
              v-for="p in (['chat', 'activity', 'members', 'snapshots'] as const)"
              :key="p"
              class="workspace-layout__panel-tab"
              :class="{ 'workspace-layout__panel-tab--active': rightPanel === p }"
              @click="rightPanel = p"
            >{{ p }}</button>
          </div>
          <button class="workspace-layout__close-panel" @click="rightPanel = null" aria-label="Close panel">×</button>
        </div>

        <div class="workspace-layout__right-body">
          <slot v-if="rightPanel === 'chat'" name="chat-panel" />
          <slot v-else-if="rightPanel === 'activity'" name="activity-panel" />
          <slot v-else-if="rightPanel === 'members'" name="member-list" />
          <slot v-else-if="rightPanel === 'snapshots'" name="snapshot-drawer" />
        </div>
      </div>
    </transition>

    <!-- Comment drawer (over canvas, triggered by element selection) -->
    <slot name="comment-drawer" />
  </div>
</template>

<style scoped>
.workspace-layout {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f8fafc;
}

.workspace-layout__left {
  width: 3rem;
  flex-shrink: 0;
  background: #1e293b;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 0;
  gap: 0.25rem;
}

.workspace-layout__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace-layout__toolbar {
  height: 2.75rem;
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  gap: 0.5rem;
}

.workspace-layout__canvas {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.workspace-layout__right {
  width: 18rem;
  flex-shrink: 0;
  border-left: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.workspace-layout__right-header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 0.5rem;
  height: 2.25rem;
  gap: 0.25rem;
}

.workspace-layout__right-tabs {
  display: flex;
  flex: 1;
  gap: 0;
}

.workspace-layout__panel-tab {
  padding: 0.375rem 0.5rem;
  font-size: 0.6875rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #64748b;
  text-transform: capitalize;
  border-bottom: 2px solid transparent;
}
.workspace-layout__panel-tab--active {
  color: #2563eb;
  border-bottom-color: #2563eb;
  font-weight: 600;
}

.workspace-layout__close-panel {
  background: none;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  font-size: 1.125rem;
  line-height: 1;
  padding: 0.25rem;
}

.workspace-layout__right-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-slide-enter-active,
.panel-slide-leave-active { transition: width 0.2s ease; overflow: hidden; }
.panel-slide-enter-from,
.panel-slide-leave-to { width: 0; }
</style>

<script setup lang="ts">
// REQ: Shared feedback primitive — persistent banners (conflict, warning, session notices)
import { useUiStore } from '@/stores/ui-store'

const uiStore = useUiStore()
</script>

<template>
  <div v-if="uiStore.banners.length > 0" class="banner-stack">
    <div
      v-for="banner in uiStore.banners"
      :key="banner.id"
      class="banner"
      :class="`banner--${banner.type}`"
      role="status"
    >
      <span class="banner__message">{{ banner.message }}</span>
      <button
        v-if="banner.dismissible"
        class="banner__close"
        aria-label="Dismiss banner"
        @click="uiStore.removeBanner(banner.id)"
      >
        ×
      </button>
    </div>
  </div>
</template>

<style scoped>
.banner-stack {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1.25rem;
  font-size: 0.875rem;
  line-height: 1.4;
}

.banner--info    { background: #eff6ff; color: #1e40af; border-bottom: 1px solid #bfdbfe; }
.banner--success { background: #f0fdf4; color: #166534; border-bottom: 1px solid #bbf7d0; }
.banner--warning { background: #fffbeb; color: #92400e; border-bottom: 1px solid #fde68a; }
.banner--error   { background: #fef2f2; color: #991b1b; border-bottom: 1px solid #fecaca; }

.banner__message { flex: 1; }

.banner__close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 1.125rem;
  line-height: 1;
  opacity: 0.7;
  padding: 0;
  margin-left: 0.75rem;
}
.banner__close:hover { opacity: 1; }
</style>

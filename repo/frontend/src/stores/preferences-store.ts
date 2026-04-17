// REQ: R15 — Preferences: theme and last-tool persisted to LocalStorage

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { LS_KEYS, lsGetString, lsSetString, type ThemePreference } from '@/services/local-storage-keys'

export type ToolType = 'select' | 'sticky' | 'arrow' | 'pen' | 'image'

export const usePreferencesStore = defineStore('preferences', () => {
  const theme = ref<ThemePreference>((lsGetString(LS_KEYS.THEME) as ThemePreference | null) ?? 'light')
  const lastTool = ref<ToolType>((lsGetString(LS_KEYS.LAST_TOOL) as ToolType | null) ?? 'select')

  function setTheme(t: ThemePreference): void {
    theme.value = t
    lsSetString(LS_KEYS.THEME, t)
  }

  function setLastTool(t: ToolType): void {
    lastTool.value = t
    lsSetString(LS_KEYS.LAST_TOOL, t)
  }

  return { theme, lastTool, setTheme, setLastTool }
})

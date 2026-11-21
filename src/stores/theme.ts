import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark' | 'system'

const THEME_KEY = 'hms_theme'

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

function applyThemeToDom(resolved: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', resolved)
  document.documentElement.style.colorScheme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', resolved === 'dark' ? '#0b1120' : '#0f766e')
  }
}

export const useThemeStore = defineStore('theme', () => {
  const saved = (localStorage.getItem(THEME_KEY) as ThemeMode | null) ?? 'system'
  const mode = ref<ThemeMode>(saved)
  const resolved = ref<'light' | 'dark'>(resolveTheme(saved))

  applyThemeToDom(resolved.value)

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    if (mode.value === 'system') {
      resolved.value = resolveTheme('system')
      applyThemeToDom(resolved.value)
    }
  })

  function setMode(next: ThemeMode): void {
    mode.value = next
    localStorage.setItem(THEME_KEY, next)
    resolved.value = resolveTheme(next)
    applyThemeToDom(resolved.value)
  }

  function toggle(): void {
    setMode(resolved.value === 'dark' ? 'light' : 'dark')
  }

  return {
    mode,
    resolved,
    setMode,
    toggle,
  }
})

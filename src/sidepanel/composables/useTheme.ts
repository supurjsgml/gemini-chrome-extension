import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'themeMode'
const LEGACY_THEME_KEY = 'theme'

function isValidThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function readStoredThemeMode(): ThemeMode {
  try {
    const legacy = localStorage.getItem(LEGACY_THEME_KEY)
    const current = localStorage.getItem(THEME_STORAGE_KEY)

    if (!isValidThemeMode(current) && isValidThemeMode(legacy)) {
      localStorage.setItem(THEME_STORAGE_KEY, legacy)
      localStorage.removeItem(LEGACY_THEME_KEY)
      return legacy
    }

    if (legacy !== null) {
      localStorage.removeItem(LEGACY_THEME_KEY)
    }

    if (isValidThemeMode(current)) {
      return current
    }
  } catch (err) {
    console.warn('Theme preference read failed:', err)
  }

  return 'system'
}

export function resolveSystemDark(): boolean {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return true
}

export function applyDocumentTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.documentElement.classList.remove('light-theme')
}

export function initThemeBeforeMount(): void {
  const mode = readStoredThemeMode()
  const resolved: ResolvedTheme = mode === 'system' ? (resolveSystemDark() ? 'dark' : 'light') : mode
  applyDocumentTheme(resolved)
}

export function useTheme() {
  const themeMode = ref<ThemeMode>(readStoredThemeMode())
  const mediaQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null
  const systemPrefersDark = ref<boolean>(mediaQuery ? mediaQuery.matches : true)

  const resolvedTheme = computed<ResolvedTheme>(() => {
    if (themeMode.value === 'system') {
      return systemPrefersDark.value ? 'dark' : 'light'
    }
    return themeMode.value
  })

  const setThemeMode = (nextMode: ThemeMode) => {
    themeMode.value = nextMode
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextMode)
    } catch (err) {
      console.warn('Theme preference write failed:', err)
    }
  }

  const handleMediaChange = (event: MediaQueryListEvent) => {
    systemPrefersDark.value = event.matches
  }

  watch(
    resolvedTheme,
    (theme) => {
      applyDocumentTheme(theme)
    },
    { immediate: true }
  )

  onMounted(() => {
    if (mediaQuery) {
      mediaQuery.addEventListener('change', handleMediaChange)
    }
  })

  onUnmounted(() => {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', handleMediaChange)
    }
  })

  return {
    themeMode,
    resolvedTheme,
    setThemeMode
  }
}

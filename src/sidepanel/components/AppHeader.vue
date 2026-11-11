<template>
  <header class="header">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path d="M9 9h6" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
        </svg>
      </span>
      <h1 class="brand-title">{{ $t('brandShortName') }}</h1>
      <span class="status-indicator" :class="connectionStatus" :title="statusLabel">
        <span class="status-dot"></span>
        <span v-if="connectionStatus === 'error'" class="status-offline-text">{{ statusLabel }}</span>
      </span>
    </div>

    <div class="header-actions">
      <div class="theme-segment" role="radiogroup" :aria-label="$t('themeGroupLabel')">
        <button
          type="button"
          role="radio"
          class="theme-segment-btn"
          :class="{ active: themeMode === 'system' }"
          :aria-checked="themeMode === 'system'"
          :title="$t('themeSystem')"
          :aria-label="$t('themeSystem')"
          @click="$emit('update:themeMode', 'system')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </button>
        <button
          type="button"
          role="radio"
          class="theme-segment-btn"
          :class="{ active: themeMode === 'light' }"
          :aria-checked="themeMode === 'light'"
          :title="$t('themeLight')"
          :aria-label="$t('themeLight')"
          @click="$emit('update:themeMode', 'light')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </svg>
        </button>
        <button
          type="button"
          role="radio"
          class="theme-segment-btn"
          :class="{ active: themeMode === 'dark' }"
          :aria-checked="themeMode === 'dark'"
          :title="$t('themeDark')"
          :aria-label="$t('themeDark')"
          @click="$emit('update:themeMode', 'dark')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        </button>
      </div>

      <div v-if="userEmail" class="user-profile-badge">
        <span class="user-email" :title="userEmail">{{ userEmail.split('@')[0] }}</span>
        <button
          type="button"
          class="logout-btn"
          :title="$t('logoutBtn')"
          :aria-label="$t('logoutBtn')"
          @click="$emit('logout')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="logout-icon">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ThemeMode } from '../composables/useTheme'
import { $t } from '../utils/i18n'

const props = defineProps<{
  themeMode: ThemeMode
  connectionStatus: 'connecting' | 'connected' | 'error'
  userEmail: string | null
}>()

defineEmits<{
  (e: 'update:themeMode', mode: ThemeMode): void
  (e: 'logout'): void
}>()

const statusLabel = computed(() => {
  if (props.connectionStatus === 'connected') return $t('statusConnected')
  if (props.connectionStatus === 'error') return $t('statusDisconnected')
  return $t('statusConnecting')
})
</script>

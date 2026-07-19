<template>
  <header class="header">
    <div class="brand">
      <div class="logo-glow"></div>
      <svg class="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" fill="url(#geminiGrad)" />
        <defs>
          <linearGradient id="geminiGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#8a2be2" />
            <stop offset="50%" stop-color="#4169e1" />
            <stop offset="100%" stop-color="#00ffff" />
          </linearGradient>
        </defs>
      </svg>
      <h1 class="title">Gemini Agent</h1>
    </div>

    <div class="header-actions">
      <button 
        @click="$emit('toggle-theme')" 
        class="theme-toggle-btn"
        :title="isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'"
      >
        <svg v-if="isDarkMode" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="4.22" x2="19.78" y2="5.64"></line>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      </button>

      <div class="status-badge" :class="connectionStatus">
        <span class="pulse-dot"></span>
        <span class="status-text">
          {{ connectionStatus === 'connected' ? $t('statusConnected') : connectionStatus === 'error' ? $t('statusDisconnected') : $t('statusConnecting') }}
        </span>
      </div>

      <div class="user-profile-badge" v-if="userEmail">
        <span class="user-email" :title="userEmail">{{ userEmail.split('@')[0] }}</span>
        <button @click="$emit('logout')" class="logout-btn" title="로그아웃">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="logout-icon">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  isDarkMode: boolean
  connectionStatus: 'connecting' | 'connected' | 'error'
  userEmail: string | null
}>()

defineEmits<{
  (e: 'toggle-theme'): void
  (e: 'logout'): void
}>()

const $t = (key: string): string => {
  if (typeof chrome !== 'undefined' && chrome.i18n) {
    return chrome.i18n.getMessage(key) || key
  }
  return key
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="logo-large-wrapper">
        <div class="logo-glow-large"></div>
        <svg class="logo-icon-large" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" fill="url(#geminiGradLarge)" />
          <defs>
            <linearGradient id="geminiGradLarge" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#8a2be2" />
              <stop offset="50%" stop-color="#4169e1" />
              <stop offset="100%" stop-color="#00ffff" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h2 class="welcome-title">Gemini AI Web Agent</h2>
      <p class="welcome-desc">
        웹페이지를 실시간으로 요약 및 자동 작성하고, 일일 사용 한도를 안전하게 지원받기 위해 구글 로그인이 필요합니다.
      </p>
      
      <button 
        class="login-btn" 
        :disabled="isLoginLoading" 
        @click="$emit('login')"
      >
        <span v-if="isLoginLoading" class="loader-container">
          <span class="spinner"></span>
          로그인 중...
        </span>
        <span v-else class="login-btn-content">
          <svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
          </svg>
          Google 계정으로 계속하기
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isLoginLoading: boolean
}>()

defineEmits<{
  (e: 'login'): void
}>()
</script>

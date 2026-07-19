<template>
  <section class="section result-section">
    <div class="result-header" v-if="resultText || isLoading">
      <label class="section-label">{{ $t('resultPreviewLabel') }}</label>
      <button 
        v-if="resultText && !isLoading" 
        class="edit-toggle-btn"
        @click="$emit('update:isEditing', !isEditing)"
      >
        {{ isEditing ? $t('editToggleDone') : $t('editToggleEdit') }}
      </button>
    </div>
    
    <div class="result-container" :class="{ loading: isLoading }" v-if="resultText || isLoading">
      <textarea 
        v-if="isEditing" 
        :value="resultText" 
        @input="$emit('update:resultText', ($event.target as HTMLTextAreaElement).value)"
        class="result-textarea"
      ></textarea>
      <div v-else class="result-display">
        {{ resultText }}
      </div>
    </div>

    <button 
      v-if="resultText && !isLoading"
      class="apply-btn" 
      @click="$emit('apply')"
    >
      <!-- 반짝이 아이콘 (Sparkles) -->
      <svg class="sparkles-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5Z"/>
        <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z"/>
      </svg>
      <span>{{ $t('applyBtn') }}</span>
    </button>

    <!-- 결과가 비어있을 때 보여줄 플레이스홀더 카드 -->
    <div class="result-placeholder-card" v-if="!resultText && !isLoading">
      <div class="placeholder-glow"></div>
      <div class="placeholder-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="36" height="36">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="url(#starGrad)" />
          <defs>
            <linearGradient id="starGrad" x1="2" y1="2" x2="22" y2="21" gradientUnits="userSpaceOnUse">
              <stop stop-color="#8a2be2" />
              <stop offset="1" stop-color="#00ffff" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div class="placeholder-title">AI 분석 대기 중</div>
      <p class="placeholder-desc">상단의 소스를 지정하고 'AI 분석 및 생성' 버튼을 누르면 이곳에 결과가 표시됩니다.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  resultText: string
  isLoading: boolean
  isEditing: boolean
}>()

defineEmits<{
  (e: 'update:resultText', value: string): void
  (e: 'update:isEditing', value: boolean): void
  (e: 'apply'): void
}>()

const $t = (key: string): string => {
  if (typeof chrome !== 'undefined' && chrome.i18n) {
    return chrome.i18n.getMessage(key) || key
  }
  return key
}
</script>

<style scoped>
.apply-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}
.sparkles-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}
.apply-btn:hover .sparkles-icon {
  transform: rotate(15deg) scale(1.15);
}
</style>

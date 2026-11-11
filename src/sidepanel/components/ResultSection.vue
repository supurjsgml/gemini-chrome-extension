<template>
  <section class="section result-section">
    <div v-if="resultText || isLoading" class="result-header">
      <label class="section-label">{{ $t('resultPreviewLabel') }}</label>
      <div v-if="resultText && !isLoading" class="result-actions">
        <button type="button" class="result-action-btn" @click="copyResult">
          <svg v-if="isCopied" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>{{ isCopied ? $t('copiedState') : $t('copyBtn') }}</span>
        </button>

        <button
          type="button"
          class="result-action-btn"
          :class="{ active: isEditing }"
          @click="$emit('update:isEditing', !isEditing)"
        >
          <svg v-if="isEditing" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          <span>{{ isEditing ? $t('editToggleDone') : $t('editToggleEdit') }}</span>
        </button>
      </div>
    </div>

    <div v-if="resultText || isLoading" class="result-container" :class="{ loading: isLoading && !resultText }">
      <div v-if="isLoading && !resultText" class="streaming-skeleton">
        <span class="streaming-status-text">{{ $t('streamingPlaceholder') }}</span>
        <div class="skeleton-line wide"></div>
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line short"></div>
      </div>
      <textarea
        v-else-if="isEditing"
        :value="resultText"
        class="result-textarea"
        @input="$emit('update:resultText', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <div v-else class="result-display">{{ resultText }}</div>
    </div>

    <button
      v-if="resultText && !isLoading"
      type="button"
      class="apply-btn"
      @click="$emit('apply')"
    >
      <svg class="insert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="9 10 4 15 9 20" />
        <path d="M20 4v7a4 4 0 0 1-4 4H4" />
      </svg>
      <span>{{ $t('applyBtn') }}</span>
    </button>

    <div v-if="!resultText && !isLoading" class="result-placeholder-card">
      <div class="placeholder-icon-box" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      </div>
      <div class="placeholder-title">{{ $t('resultEmptyTitle') }}</div>
      <p class="placeholder-desc">{{ $t('resultEmptyDesc') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { $t } from '../utils/i18n'

const props = defineProps<{
  resultText: string
  isLoading: boolean
  isEditing: boolean
}>()

const emit = defineEmits<{
  (e: 'update:resultText', value: string): void
  (e: 'update:isEditing', value: boolean): void
  (e: 'apply'): void
  (e: 'copy-error'): void
}>()

const isCopied = ref(false)
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null

const clearCopyTimer = () => {
  if (copyFeedbackTimer !== null) {
    clearTimeout(copyFeedbackTimer)
    copyFeedbackTimer = null
  }
}

const copyResult = async () => {
  if (!props.resultText) return
  try {
    await navigator.clipboard.writeText(props.resultText)
    isCopied.value = true
    clearCopyTimer()
    copyFeedbackTimer = setTimeout(() => {
      isCopied.value = false
      copyFeedbackTimer = null
    }, 1600)
  } catch (err) {
    console.warn('Clipboard copy failed:', err)
    emit('copy-error')
  }
}

onUnmounted(() => {
  clearCopyTimer()
})
</script>

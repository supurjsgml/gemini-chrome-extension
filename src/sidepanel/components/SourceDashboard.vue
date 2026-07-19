<template>
  <section class="section">
    <label class="section-label">{{ $t('sourceLabel') }}</label>
    <div class="tab-group">
      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: contextSource === 'selection' }" 
        :disabled="!currentContext?.selectedText"
        @click="$emit('update:contextSource', 'selection')"
      >
        {{ $t('sourceSelection') }}
      </button>
      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: contextSource === 'page' }" 
        @click="$emit('update:contextSource', 'page')"
      >
        {{ $t('sourcePage') }}
      </button>
      <button 
        type="button" 
        class="tab-btn" 
        :class="{ active: contextSource === 'direct' }" 
        @click="$emit('update:contextSource', 'direct')"
      >
        {{ $t('sourceDirect') }}
      </button>
    </div>

    <!-- 직접 입력 탭 -->
    <div v-if="contextSource === 'direct'" class="direct-input-wrapper">
      <textarea 
        :value="directInputText" 
        @input="$emit('update:directInputText', ($event.target as HTMLTextAreaElement).value)" 
        class="custom-textarea" 
        style="margin-top: 10px; min-height: 90px;"
        :placeholder="$t('directInputPlaceholder')"
      ></textarea>
    </div>

    <!-- 스마트 대시보드 탭 -->
    <div v-else class="context-preview-dashboard">
      <div class="dashboard-card" v-if="(contextSource === 'selection' && currentContext?.selectedText) || (contextSource === 'page' && currentContext?.pageText)">
        <div class="card-header">
          <div class="site-info">
            <span class="active-dot"></span>
            <span class="site-title">{{ currentContext?.title || 'Web Page' }}</span>
          </div>
          <div class="data-size-badge">{{ textMetrics.byteSize }}</div>
        </div>

        <div class="metrics-grid">
          <div class="metric-item">
            <span class="metric-label">글자 수</span>
            <span class="metric-value">{{ textMetrics.length }}자</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">단어 수</span>
            <span class="metric-value">{{ textMetrics.words }}개</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">읽기 시간</span>
            <span class="metric-value">{{ textMetrics.readTime }}분</span>
          </div>
        </div>

        <div class="keywords-section" v-if="extractedKeywords.length > 0">
          <div class="section-subtitle">주요 토픽 분석</div>
          <div class="keyword-chips">
            <span v-for="keyword in extractedKeywords" :key="keyword" class="keyword-chip">
              # {{ keyword }}
            </span>
          </div>
        </div>

        <div class="accordion-section">
          <button 
            type="button" 
            class="accordion-toggle-btn"
            @click="showRawText = !showRawText"
          >
            <span>📄 원본 내용 미리보기</span>
            <span class="arrow-icon" :class="{ rotated: showRawText }">▼</span>
          </button>
          
          <div class="accordion-content" :class="{ open: showRawText }">
            <div class="raw-text-scroll">
              {{ contextSource === 'selection' ? currentContext?.selectedText : currentContext?.pageText }}
            </div>
          </div>
        </div>
      </div>

      <!-- 데이터 소스 부재 시 에러/가이드 메시지 -->
      <div class="no-data-card" v-else>
        <div class="no-data-icon">⚠️</div>
        <p class="preview-text text-muted" v-if="contextSource === 'selection'">
          {{ $t('noSelectionText') }}
        </p>
        <p class="preview-text text-muted" v-else>
          {{ $t('noPageText') }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface ExtensionContent {
  selectedText: string
  pageText: string
  title: string
}

interface TextMetrics {
  length: number
  words: number
  byteSize: string
  readTime: number
}

const props = defineProps<{
  contextSource: 'selection' | 'page' | 'direct'
  currentContext: ExtensionContent | null
  directInputText: string
  textMetrics: TextMetrics
  extractedKeywords: string[]
}>()

defineEmits<{
  (e: 'update:contextSource', value: 'selection' | 'page' | 'direct'): void
  (e: 'update:directInputText', value: string): void
}>()

const showRawText = ref(false)

// 내용 수집 시 아코디언 자동 열림 감시자
watch(
  () => props.currentContext,
  (newContext) => {
    if (newContext) {
      const text = props.contextSource === 'selection' ? newContext.selectedText : newContext.pageText
      if (text && text.trim().length > 0) {
        showRawText.value = true
      }
    }
  },
  { immediate: true, deep: true }
)

watch(
  () => props.contextSource,
  (newSource) => {
    if (props.currentContext) {
      const text = newSource === 'selection' ? props.currentContext.selectedText : props.currentContext.pageText
      if (text && text.trim().length > 0) {
        showRawText.value = true
      }
    }
  }
)

const $t = (key: string): string => {
  if (typeof chrome !== 'undefined' && chrome.i18n) {
    return chrome.i18n.getMessage(key) || key
  }
  return key
}
</script>

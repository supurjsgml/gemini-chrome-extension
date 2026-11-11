<template>
  <section class="section">
    <div class="section-header-row">
      <label class="section-label">{{ $t('sourceLabel') }}</label>
      <button
        v-if="contextSource !== 'direct'"
        type="button"
        class="text-icon-btn"
        :title="$t('refreshSource')"
        :aria-label="$t('refreshSource')"
        @click="$emit('refresh')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 16h5v5" />
        </svg>
      </button>
    </div>

    <div class="tab-group" role="tablist">
      <button
        type="button"
        role="tab"
        class="tab-btn"
        :class="{ active: contextSource === 'selection' }"
        :aria-selected="contextSource === 'selection'"
        :disabled="!currentContext?.selectedText"
        @click="$emit('update:contextSource', 'selection')"
      >
        {{ $t('sourceSelection') }}
      </button>
      <button
        type="button"
        role="tab"
        class="tab-btn"
        :class="{ active: contextSource === 'page' }"
        :aria-selected="contextSource === 'page'"
        @click="$emit('update:contextSource', 'page')"
      >
        {{ $t('sourcePage') }}
      </button>
      <button
        type="button"
        role="tab"
        class="tab-btn"
        :class="{ active: contextSource === 'direct' }"
        :aria-selected="contextSource === 'direct'"
        @click="$emit('update:contextSource', 'direct')"
      >
        {{ $t('sourceDirect') }}
      </button>
    </div>

    <div v-if="contextSource === 'direct'" class="direct-input-wrapper">
      <textarea
        :value="directInputText"
        class="custom-textarea direct-textarea"
        :placeholder="$t('directInputPlaceholder')"
        @input="$emit('update:directInputText', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
    </div>

    <div v-else class="context-summary-wrapper">
      <div v-if="hasActiveText" class="context-card">
        <div class="context-summary-bar">
          <div class="site-info">
            <svg class="context-doc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span class="site-title" :title="currentContext?.title || $t('untitledPage')">
              {{ currentContext?.title || $t('untitledPage') }}
            </span>
          </div>
          <span class="data-size-badge">{{ textMetrics.byteSize }}</span>
        </div>

        <div class="context-meta-row">
          <div class="inline-metrics">
            <span>{{ textMetrics.length.toLocaleString() }}{{ $t('unitChars') }}</span>
            <span class="meta-dot" aria-hidden="true"></span>
            <span>{{ textMetrics.words.toLocaleString() }}{{ $t('unitWords') }}</span>
            <span class="meta-dot" aria-hidden="true"></span>
            <span>{{ textMetrics.readTime }}{{ $t('unitMinutes') }}</span>
          </div>

          <button
            type="button"
            class="raw-toggle-btn"
            :aria-expanded="showRawText"
            @click="showRawText = !showRawText"
          >
            <span>{{ showRawText ? $t('rawPreviewHide') : $t('rawPreviewShow') }}</span>
            <svg class="chevron-icon" :class="{ rotated: showRawText }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        <div v-if="extractedKeywords.length > 0" class="keyword-row">
          <span class="keyword-label">{{ $t('keywordsTitle') }}</span>
          <div class="keyword-chips">
            <span v-for="keyword in extractedKeywords" :key="keyword" class="keyword-chip">
              {{ keyword }}
            </span>
          </div>
        </div>

        <div v-if="showRawText" class="raw-preview-drawer">
          <div class="raw-text-scroll">{{ activeRawText }}</div>
        </div>
      </div>

      <div v-else class="no-data-card">
        <svg class="no-data-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p class="no-data-text">
          {{ contextSource === 'selection' ? $t('noSelectionText') : $t('noPageText') }}
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { $t } from '../utils/i18n'

export interface ExtensionContent {
  selectedText: string
  pageText: string
  title: string
}

export interface TextMetrics {
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
  (e: 'refresh'): void
}>()

const showRawText = ref(false)

const activeRawText = computed(() => {
  if (!props.currentContext) return ''
  return props.contextSource === 'selection'
    ? props.currentContext.selectedText
    : props.currentContext.pageText
})

const hasActiveText = computed(() => Boolean(activeRawText.value && activeRawText.value.trim().length > 0))
</script>

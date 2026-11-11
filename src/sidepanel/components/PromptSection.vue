<template>
  <section class="section">
    <div class="section-header-row">
      <label class="section-label" for="prompt-composer-input">{{ $t('promptLabel') }}</label>
      <span class="section-caption">{{ $t('presetGuide') }}</span>
    </div>

    <div class="preset-chips">
      <button
        v-for="preset in presets"
        :key="preset.id"
        type="button"
        class="chip-btn"
        @click="$emit('update:modelValue', preset.prompt)"
      >
        <svg v-if="preset.id === 'summary'" class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <svg v-else-if="preset.id === 'report'" class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="17" x2="8" y2="12" />
          <line x1="12" y1="17" x2="12" y2="10" />
          <line x1="16" y1="17" x2="16" y2="14" />
        </svg>
        <svg v-else-if="preset.id === 'email'" class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
        <svg v-else class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m8 2 1.88 1.88" />
          <path d="M14.12 3.88 16 2" />
          <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
          <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6Z" />
          <path d="M12 9v4" />
          <path d="M9 14h6" />
        </svg>
        <span>{{ preset.label }}</span>
      </button>
    </div>

    <div class="composer-box">
      <div v-if="attachments.length > 0" class="attachment-region">
        <div class="attachment-header">
          <span class="attachment-count-label">{{ attachments.length }} / {{ maxAttachments }}</span>
          <button
            type="button"
            class="clear-attachments-btn"
            @click="$emit('clear-attachments')"
          >
            {{ $t('clearAllAttachments') }}
          </button>
        </div>

        <div class="attachment-strip">
          <div v-for="img in attachments" :key="img.id" class="attachment-card">
            <button
              type="button"
              class="attachment-thumb-btn"
              :title="$t('previewImageTitle')"
              @click="previewTarget = img"
            >
              <img
                :src="img.previewUrl"
                :alt="img.source === 'capture' ? $t('attachmentSourceCapture') : $t('attachmentSourceClipboard')"
                class="attachment-thumb-img"
              />
            </button>
            <div class="attachment-meta">
              <span class="attachment-source">
                {{ img.source === 'capture' ? $t('attachmentSourceCapture') : $t('attachmentSourceClipboard') }}
              </span>
              <span class="attachment-spec">
                {{ img.width }}x{{ img.height }} · {{ formatByteSize(img.byteSize) }}
              </span>
            </div>
            <button
              type="button"
              class="attachment-remove-btn"
              :title="$t('removeAttachment')"
              :aria-label="$t('removeAttachment')"
              @click="$emit('remove-attachment', img.id)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <textarea
        id="prompt-composer-input"
        :value="modelValue"
        class="composer-textarea"
        :placeholder="$t('promptPlaceholder')"
        @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        @paste="onPromptPaste"
        @keydown="onPromptKeydown"
      ></textarea>

      <div class="composer-toolbar">
        <div class="composer-tools-left">
          <button
            type="button"
            class="capture-action-btn"
            :disabled="isCaptureButtonDisabled"
            :title="captureButtonTitle"
            @click="$emit('capture')"
          >
            <span v-if="isCapturing" class="spinner spinner-xs"></span>
            <svg v-else class="capture-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            <span>{{ isCapturing ? $t('capturingState') : $t('captureScreenBtn') }}</span>
          </button>
        </div>

        <div class="composer-tools-right">
          <span class="attachment-quota-badge" :class="{ full: attachments.length >= maxAttachments }">
            {{ attachments.length }}/{{ maxAttachments }}
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="previewTarget"
      class="image-modal-backdrop"
      role="dialog"
      aria-modal="true"
      :aria-label="$t('previewImageTitle')"
      @click.self="previewTarget = null"
    >
      <div class="image-modal-content">
        <div class="image-modal-header">
          <span class="image-modal-meta">
            {{ previewTarget.source === 'capture' ? $t('attachmentSourceCapture') : $t('attachmentSourceClipboard') }}
            · {{ previewTarget.width }}x{{ previewTarget.height }}
            · {{ formatByteSize(previewTarget.byteSize) }}
          </span>
          <button
            type="button"
            class="modal-close-btn"
            :title="$t('closePreviewModal')"
            :aria-label="$t('closePreviewModal')"
            @click="previewTarget = null"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div class="image-modal-body">
          <img :src="previewTarget.previewUrl" :alt="$t('previewImageTitle')" class="image-modal-img" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { formatByteSize, type AttachedImage } from '../utils/imageProcessor'
import { $t } from '../utils/i18n'

export interface PresetItem {
  id: 'summary' | 'report' | 'email' | 'bug'
  label: string
  prompt: string
}

const props = defineProps<{
  modelValue: string
  presets: PresetItem[]
  attachments: AttachedImage[]
  maxAttachments: number
  canCapture: boolean
  isCapturing: boolean
  isDisabled: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'capture'): void
  (e: 'paste-images', files: Blob[]): void
  (e: 'remove-attachment', id: string): void
  (e: 'clear-attachments'): void
  (e: 'submit'): void
}>()

const previewTarget = ref<AttachedImage | null>(null)

const isCaptureButtonDisabled = computed(() => {
  return (
    !props.canCapture ||
    props.isCapturing ||
    props.isDisabled ||
    props.attachments.length >= props.maxAttachments
  )
})

const captureButtonTitle = computed(() => {
  if (!props.canCapture) {
    return $t('captureRestrictedUrl')
  }
  if (props.attachments.length >= props.maxAttachments) {
    return $t('maxAttachmentsReached', String(props.maxAttachments))
  }
  return $t('captureTooltipActive')
})

const onPromptPaste = (event: ClipboardEvent) => {
  const clipboard = event.clipboardData
  if (!clipboard) return

  const plainText = clipboard.getData('text/plain')
  if (plainText && plainText.trim().length > 0) {
    return
  }

  const imageFiles: Blob[] = []
  const items = Array.from(clipboard.items || [])
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        imageFiles.push(file)
      }
    }
  }

  if (imageFiles.length === 0) return

  event.preventDefault()
  emit('paste-images', imageFiles)
}

const onPromptKeydown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    emit('submit')
  }
}

const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && previewTarget.value) {
    previewTarget.value = null
  }
}

watch(
  () => props.attachments,
  (list: AttachedImage[]) => {
    if (previewTarget.value && !list.some((item: AttachedImage) => item.id === previewTarget.value?.id)) {
      previewTarget.value = null
    }
  },
  { deep: true }
)

watch(previewTarget, (target) => {
  if (target) {
    window.addEventListener('keydown', handleEscapeKey)
  } else {
    window.removeEventListener('keydown', handleEscapeKey)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscapeKey)
})
</script>

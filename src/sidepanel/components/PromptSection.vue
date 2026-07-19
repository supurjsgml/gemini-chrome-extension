<template>
  <section class="section">
    <label class="section-label">{{ $t('promptLabel') }}</label>
    <textarea 
      :value="modelValue" 
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)" 
      class="custom-textarea" 
      :placeholder="$t('promptPlaceholder')"
    ></textarea>
    
    <!-- 프리셋 선택 영역 -->
    <div class="preset-section">
      <div class="preset-guide-label">
        <svg class="guide-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4"/>
          <path d="M12 8h.01"/>
        </svg>
        <span>{{ $t('presetGuide') }}</span>
      </div>

      <div class="preset-chips">
        <button 
          v-for="preset in presets" 
          :key="preset.label" 
          class="chip-btn"
          @click="$emit('update:modelValue', preset.prompt)"
        >
          <!-- 요약 아이콘 (File-text) -->
          <svg v-if="isPresetType(preset.label, 'summary')" class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
          
          <!-- 보고서 아이콘 (File-bar-chart-2) -->
          <svg v-else-if="isPresetType(preset.label, 'report')" class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="17" x2="8" y2="11"/>
            <line x1="12" y1="17" x2="12" y2="13"/>
            <line x1="16" y1="17" x2="16" y2="15"/>
          </svg>

          <!-- 이메일 아이콘 (Mail) -->
          <svg v-else-if="isPresetType(preset.label, 'email')" class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>

          <!-- 버그 리포트 아이콘 (Bug) -->
          <svg v-else-if="isPresetType(preset.label, 'bug')" class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m8 2 1.88 1.88"/>
            <path d="M14.12 3.88 16 2"/>
            <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/>
            <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6Z"/>
            <path d="M12 9v4"/>
            <path d="M9 14h6"/>
            <path d="M6 11H3"/>
            <path d="M21 11h-3"/>
          </svg>

          <span>{{ preset.label }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface PresetItem {
  label: string
  prompt: string
}

const props = defineProps<{
  modelValue: string
  presets: PresetItem[]
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const isPresetType = (label: string, type: 'summary' | 'report' | 'email' | 'bug'): boolean => {
  const lowerLabel = label.toLowerCase()
  if (type === 'summary') {
    return lowerLabel.includes('요약') || lowerLabel.includes('summary')
  }
  if (type === 'report') {
    return lowerLabel.includes('보고서') || lowerLabel.includes('report')
  }
  if (type === 'email') {
    return lowerLabel.includes('이메일') || lowerLabel.includes('email')
  }
  if (type === 'bug') {
    return lowerLabel.includes('버그') || lowerLabel.includes('bug')
  }
  return false
}

const $t = (key: string): string => {
  if (typeof chrome !== 'undefined' && chrome.i18n) {
    return chrome.i18n.getMessage(key) || key
  }
  return key
}
</script>

<style scoped>
.preset-section {
  margin-top: 12px;
}
.preset-guide-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.45));
  margin-bottom: 8px;
  letter-spacing: -0.3px;
}
.guide-icon {
  width: 12px;
  height: 12px;
  opacity: 0.8;
}
.preset-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 11px;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(255, 255, 255, 0.16);
  border-radius: 100px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.chip-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.35);
  color: #fff;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.05);
}
.chip-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  opacity: 0.75;
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.chip-btn:hover .chip-icon {
  opacity: 1;
  transform: translateY(-0.5px);
}
</style>

<template>
  <section class="section model-section">
    <div class="section-header-row">
      <label class="section-label" for="gemini-model-select">{{ $t('modelLabel') }}</label>
      <span v-if="selectedDesc" class="model-desc-inline" :title="selectedDesc">{{ selectedDesc }}</span>
    </div>
    <div class="select-field-wrapper">
      <select
        id="gemini-model-select"
        :value="modelValue"
        class="custom-select"
        @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="model in models" :key="model.id" :value="model.id">
          {{ model.name }}
        </option>
      </select>
      <svg class="select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { $t } from '../utils/i18n'

export interface GeminiModel {
  id: string
  name: string
  desc: string
  isDefault?: boolean
}

const props = defineProps<{
  modelValue: string
  models: GeminiModel[]
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const selectedDesc = computed(() => {
  return props.models.find((m: GeminiModel) => m.id === props.modelValue)?.desc || ''
})
</script>

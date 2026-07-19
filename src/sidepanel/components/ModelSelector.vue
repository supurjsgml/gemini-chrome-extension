<template>
  <section class="section">
    <label class="section-label">{{ $t('modelLabel') }}</label>
    <div class="select-wrapper">
      <select 
        :value="modelValue" 
        @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)" 
        class="custom-select"
      >
        <option v-for="model in models" :key="model.id" :value="model.id">
          {{ model.name }}
        </option>
      </select>
      <div class="select-desc">
        {{ models.find(m => m.id === modelValue)?.desc }}
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface GeminiModel {
  id: string
  name: string
  desc: string
}

defineProps<{
  modelValue: string
  models: GeminiModel[]
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const $t = (key: string): string => {
  if (typeof chrome !== 'undefined' && chrome.i18n) {
    return chrome.i18n.getMessage(key) || key
  }
  return key
}
</script>

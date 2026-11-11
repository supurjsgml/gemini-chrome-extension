<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import AppHeader from './components/AppHeader.vue'
import LoginSection from './components/LoginSection.vue'
import ModelSelector, { type GeminiModel } from './components/ModelSelector.vue'
import SourceDashboard, { type ExtensionContent } from './components/SourceDashboard.vue'
import PromptSection, { type PresetItem } from './components/PromptSection.vue'
import ResultSection from './components/ResultSection.vue'
import { useTheme } from './composables/useTheme'
import { $t } from './utils/i18n'
import {
  MAX_ATTACHED_IMAGES,
  processImageBlob,
  processDataUrl,
  revokeAttachedImage,
  revokeAttachedImages,
  type AttachedImage
} from './utils/imageProcessor'

const CAPTURE_COOLDOWN_MS = 600

const { themeMode, setThemeMode } = useTheme()

const models = ref<GeminiModel[]>([])
const selectedModel = ref(localStorage.getItem('selectedModel') || '')
const promptText = ref('')
const resultText = ref('')
const isEditing = ref(false)
const isLoading = ref(false)
const connectionStatus = ref<'connecting' | 'connected' | 'error'>('connecting')
const currentContext = ref<ExtensionContent | null>(null)
const contextSource = ref<'selection' | 'page' | 'direct'>('page')
const directInputText = ref('')
const statusMessage = ref('')
const statusType = ref<'success' | 'error' | ''>('')

const activeTabUrl = ref('')
const attachedImages = ref<AttachedImage[]>([])
const isCapturing = ref(false)
const isCaptureCooldown = ref(false)

const userEmail = ref<string | null>(localStorage.getItem('userEmail'))
const userToken = ref<string | null>(null)
const isLoginLoading = ref(false)

let statusTimer: ReturnType<typeof setTimeout> | null = null
let captureCooldownTimer: ReturnType<typeof setTimeout> | null = null
let contentRetryTimer: ReturnType<typeof setTimeout> | null = null
let injectRetryTimer: ReturnType<typeof setTimeout> | null = null

watch(selectedModel, (newModel) => {
  if (newModel) {
    localStorage.setItem('selectedModel', newModel)
  }
})

watch(contextSource, (newSource) => {
  if (newSource === 'page' || newSource === 'selection') {
    fetchPageContent()
  }
})

const isRestrictedWebUrl = (url?: string): boolean => {
  if (!url) return true
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return true
  }
  if (
    url.startsWith('https://chromewebstore.google.com') ||
    url.startsWith('https://chrome.google.com/webstore')
  ) {
    return true
  }
  return false
}

const isTabCapturable = computed(() => !isRestrictedWebUrl(activeTabUrl.value))

const canGenerate = computed(() => {
  if (isLoading.value) return false
  if (attachedImages.value.length > 0) return true
  if (contextSource.value === 'selection') {
    return Boolean(currentContext.value?.selectedText?.trim())
  }
  if (contextSource.value === 'page') {
    return Boolean(currentContext.value?.pageText?.trim())
  }
  return Boolean(directInputText.value.trim())
})

const textMetrics = computed(() => {
  const text =
    contextSource.value === 'selection'
      ? currentContext.value?.selectedText
      : currentContext.value?.pageText

  if (!text) return { length: 0, words: 0, byteSize: '0 B', readTime: 0 }

  const length = text.length
  const words = text.trim().split(/\s+/).filter(Boolean).length

  const encoder = new TextEncoder()
  const bytes = encoder.encode(text).length
  let byteSize = `${bytes} B`
  if (bytes > 1024 * 1024) {
    byteSize = `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  } else if (bytes > 1024) {
    byteSize = `${(bytes / 1024).toFixed(1)} KB`
  }

  const readTime = Math.max(1, Math.ceil(length / 500))
  return { length, words, byteSize, readTime }
})

const extractedKeywords = computed(() => {
  const text =
    contextSource.value === 'selection'
      ? currentContext.value?.selectedText
      : currentContext.value?.pageText

  if (!text) return []

  const words = text.match(/[가-힣a-zA-Z0-9_]{2,10}/g) || []
  const stopWords = new Set([
    '이거', '저거', '그거', '하는', '한다', '있습니다', '있는', '대한', '위해',
    '그리고', '하지만', '또한', '에서', '으로', '하고', 'https', 'http', 'com',
    '것은', '것을', '것이', '등을', '등의', '하여', '통해', '설정', '사용', '클릭'
  ])
  const freqMap: Record<string, number> = {}

  words.forEach((word) => {
    const lower = word.toLowerCase()
    if (!stopWords.has(lower) && isNaN(Number(lower))) {
      freqMap[lower] = (freqMap[lower] || 0) + 1
    }
  })

  return Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((entry) => entry[0])
})

const presets = computed<PresetItem[]>(() => [
  { id: 'summary', label: $t('presetSummaryLabel'), prompt: $t('presetSummaryPrompt') },
  { id: 'report', label: $t('presetReportLabel'), prompt: $t('presetReportPrompt') },
  { id: 'email', label: $t('presetEmailLabel'), prompt: $t('presetEmailPrompt') },
  { id: 'bug', label: $t('presetBugLabel'), prompt: $t('presetBugPrompt') }
])

const showStatus = (msg: string, type: 'success' | 'error') => {
  statusMessage.value = msg
  statusType.value = type
  if (statusTimer !== null) {
    clearTimeout(statusTimer)
  }
  statusTimer = setTimeout(() => {
    statusMessage.value = ''
    statusType.value = ''
    statusTimer = null
  }, 4000)
}

const removeAttachedImage = (id: string) => {
  const index = attachedImages.value.findIndex((item) => item.id === id)
  if (index === -1) return
  const [removed] = attachedImages.value.splice(index, 1)
  if (removed) {
    revokeAttachedImage(removed)
  }
}

const clearAttachedImages = () => {
  if (attachedImages.value.length === 0) return
  revokeAttachedImages(attachedImages.value)
  attachedImages.value = []
}

const captureCurrentTab = async () => {
  if (isCapturing.value || isCaptureCooldown.value || isLoading.value) return

  if (attachedImages.value.length >= MAX_ATTACHED_IMAGES) {
    showStatus($t('maxAttachmentsReached', String(MAX_ATTACHED_IMAGES)), 'error')
    return
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    activeTabUrl.value = tab?.url || ''

    if (!tab || typeof tab.windowId !== 'number' || isRestrictedWebUrl(tab.url)) {
      showStatus($t('captureRestrictedUrl'), 'error')
      return
    }

    isCapturing.value = true

    const dataUrl = await new Promise<string>((resolve, reject) => {
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (capturedUrl) => {
        if (chrome.runtime.lastError || !capturedUrl) {
          reject(new Error(chrome.runtime.lastError?.message || 'captureVisibleTab failed'))
          return
        }
        resolve(capturedUrl)
      })
    })

    const processed = await processDataUrl(dataUrl, 'capture')
    attachedImages.value.push(processed)
    showStatus($t('captureSuccess'), 'success')
  } catch (err: any) {
    showStatus($t('captureFailed') + (err?.message || ''), 'error')
  } finally {
    isCapturing.value = false
    isCaptureCooldown.value = true
    if (captureCooldownTimer !== null) {
      clearTimeout(captureCooldownTimer)
    }
    captureCooldownTimer = setTimeout(() => {
      isCaptureCooldown.value = false
      captureCooldownTimer = null
    }, CAPTURE_COOLDOWN_MS)
  }
}

const handlePasteImages = async (blobs: Blob[]) => {
  const remainingSlots = MAX_ATTACHED_IMAGES - attachedImages.value.length
  if (remainingSlots <= 0) {
    showStatus($t('maxAttachmentsReached', String(MAX_ATTACHED_IMAGES)), 'error')
    return
  }

  const targets = blobs.slice(0, remainingSlots)
  let addedCount = 0

  for (const blob of targets) {
    try {
      const processed = await processImageBlob(blob, 'clipboard')
      attachedImages.value.push(processed)
      addedCount += 1
    } catch (err: any) {
      showStatus($t('pasteImageFailed') + (err?.message || ''), 'error')
      return
    }
  }

  if (blobs.length > remainingSlots) {
    showStatus($t('maxAttachmentsReached', String(MAX_ATTACHED_IMAGES)), 'error')
  } else if (addedCount > 0) {
    showStatus($t('pasteImageSuccess'), 'success')
  }
}

const loginWithGoogle = () => {
  isLoginLoading.value = true
  if (typeof chrome !== 'undefined' && chrome.identity) {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.error('구글 로그인 실패:', chrome.runtime.lastError)
        showStatus($t('loginFailed'), 'error')
        isLoginLoading.value = false
        return
      }
      userToken.value = token

      fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.email) {
            userEmail.value = data.email
            localStorage.setItem('userEmail', data.email)
            showStatus($t('loginSuccess'), 'success')
          } else {
            showStatus($t('userInfoFailed'), 'error')
          }
        })
        .catch((err) => {
          console.error('구글 사용자 정보 획득 실패:', err)
          showStatus($t('userInfoFailed'), 'error')
        })
        .finally(() => {
          isLoginLoading.value = false
        })
    })
  } else {
    isLoginLoading.value = false
  }
}

const logout = () => {
  clearAttachedImages()
  if (userToken.value && typeof chrome !== 'undefined' && chrome.identity) {
    chrome.identity.removeCachedAuthToken({ token: userToken.value }, () => {
      userToken.value = null
      userEmail.value = null
      localStorage.removeItem('userEmail')
      showStatus($t('logoutSuccess'), 'success')
    })
  } else {
    userToken.value = null
    userEmail.value = null
    localStorage.removeItem('userEmail')
    showStatus($t('logoutSuccess'), 'success')
  }
}

const ensureContentScriptInjected = async (tabId: number): Promise<boolean> => {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (isRestrictedWebUrl(tab?.url)) {
      return false
    }
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    })
    return true
  } catch (err: any) {
    console.error('컨텐트 스크립트 동적 주입 실패:', err)
    return false
  }
}

const fetchPageContent = async (specificTabId?: number, retryCount = 0): Promise<void> => {
  try {
    let tabId = specificTabId
    if (!tabId) {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
      if (!tab || !tab.id) {
        activeTabUrl.value = ''
        return
      }
      tabId = tab.id
    }

    const currentTab = await chrome.tabs.get(tabId)
    activeTabUrl.value = currentTab?.url || ''

    if (isRestrictedWebUrl(currentTab?.url)) {
      currentContext.value = null
      return
    }

    await new Promise<void>((resolve) => {
      chrome.tabs.sendMessage(tabId!, { action: 'getPageContent' }, async (response) => {
        if (chrome.runtime.lastError) {
          if (retryCount < 5) {
            const injected = await ensureContentScriptInjected(tabId!)
            if (!injected) {
              currentContext.value = null
              resolve()
              return
            }
            if (contentRetryTimer !== null) {
              clearTimeout(contentRetryTimer)
            }
            contentRetryTimer = setTimeout(() => {
              contentRetryTimer = null
              fetchPageContent(tabId, retryCount + 1).finally(resolve)
            }, 400)
          } else {
            currentContext.value = null
            resolve()
          }
          return
        }

        if (response) {
          currentContext.value = response
        }
        resolve()
      })
    })
  } catch (err: any) {
    console.error('페이지 정보 획득 실패:', err)
  }
}

const PRIMARY_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://guney-api.kro.kr'
const FALLBACK_API_BASE_URL =
  import.meta.env.VITE_FALLBACK_API_BASE_URL ||
  'https://rest-api.ashysand-9f47a7e7.koreasouth.azurecontainerapps.io'

const fetchWithFallback = async (endpoint: string, options?: RequestInit): Promise<Response> => {
  const primaryUrl = `${PRIMARY_API_BASE_URL}${endpoint}`
  const fallbackUrl = `${FALLBACK_API_BASE_URL}${endpoint}`

  let primaryResponse: Response | null = null
  let primaryError: any = null

  try {
    primaryResponse = await fetch(primaryUrl, options)
    if (primaryResponse.ok || primaryResponse.status === 500 || primaryResponse.status === 401) {
      return primaryResponse
    }
  } catch (err) {
    primaryError = err
  }

  try {
    return await fetch(fallbackUrl, options)
  } catch (fallbackError) {
    if (primaryResponse) {
      return primaryResponse
    }
    throw fallbackError || primaryError
  }
}

const isAuthExpiredMessage = (msg: string): boolean => {
  const lower = msg.toLowerCase()
  return (
    msg.includes('유효하지 않은 구글 인증 토큰') ||
    lower.includes('invalid_token') ||
    lower.includes('unauthorized')
  )
}

const refreshGoogleAuthToken = async (): Promise<string | null> => {
  if (typeof chrome === 'undefined' || !chrome.identity) {
    return null
  }
  const staleToken = userToken.value
  if (staleToken) {
    await new Promise<void>((resolve) => {
      chrome.identity.removeCachedAuthToken({ token: staleToken }, () => {
        resolve()
      })
    })
  }

  return new Promise<string | null>((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (freshToken) => {
      if (chrome.runtime.lastError || !freshToken) {
        userToken.value = null
        resolve(null)
        return
      }
      userToken.value = freshToken
      resolve(freshToken)
    })
  })
}

const readErrorBodyMessage = async (response: Response): Promise<string> => {
  const rawText = await response.text().catch(() => '')
  if (!rawText) {
    return $t('requestFailedWithStatus', String(response.status))
  }
  try {
    const parsed = JSON.parse(rawText)
    if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message
    }
  } catch (parseErr) {
    if (rawText.trim()) {
      return rawText.trim()
    }
    console.warn('Error response parse fallback:', parseErr)
  }
  return rawText.trim() || $t('requestFailedWithStatus', String(response.status))
}

const executeSummarizeRequest = async (
  textToAnalyze: string,
  allowTokenRetry: boolean
): Promise<void> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (userToken.value) {
    headers['Authorization'] = `Bearer ${userToken.value}`
  }

  const payload: {
    text: string
    prompt: string
    model: string
    images?: Array<{ mimeType: string; data: string }>
  } = {
    text: textToAnalyze,
    prompt: promptText.value,
    model: selectedModel.value
  }

  if (attachedImages.value.length > 0) {
    payload.images = attachedImages.value.map((img) => ({
      mimeType: img.mimeType,
      data: img.base64Data
    }))
  }

  const response = await fetchWithFallback('/api/gemini/summarize', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorMsg = await readErrorBodyMessage(response)
    if (allowTokenRetry && (response.status === 401 || isAuthExpiredMessage(errorMsg))) {
      const refreshed = await refreshGoogleAuthToken()
      if (refreshed) {
        return executeSummarizeRequest(textToAnalyze, false)
      }
    }
    showStatus(errorMsg, 'error')
    return
  }

  if (!response.body) {
    showStatus($t('streamUnavailable'), 'error')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  resultText.value = ''
  isEditing.value = false

  let hasStreamError = false
  let streamErrorText = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    if (!hasStreamError && resultText.value === '' && chunk.startsWith('ERROR:')) {
      hasStreamError = true
      streamErrorText = chunk.substring(6)
      continue
    }

    if (hasStreamError) {
      streamErrorText += chunk
    } else {
      resultText.value += chunk
    }
  }

  const tail = decoder.decode()
  if (tail) {
    if (hasStreamError) {
      streamErrorText += tail
    } else {
      resultText.value += tail
    }
  }

  if (hasStreamError) {
    const cleanErr = streamErrorText.trim()
    resultText.value = ''
    if (allowTokenRetry && isAuthExpiredMessage(cleanErr)) {
      const refreshed = await refreshGoogleAuthToken()
      if (refreshed) {
        return executeSummarizeRequest(textToAnalyze, false)
      }
    }
    showStatus(cleanErr || $t('requestFailedWithStatus', 'ERROR'), 'error')
    return
  }

  clearAttachedImages()
  showStatus($t('generationSuccess'), 'success')
}

const generateAIResult = async () => {
  if (isLoading.value) return

  if (contextSource.value !== 'direct' && !currentContext.value) {
    await fetchPageContent()
    if (!currentContext.value && attachedImages.value.length === 0) {
      showStatus($t('noInputToAnalyze'), 'error')
      return
    }
  }

  let textToAnalyze = ''
  if (contextSource.value === 'selection') {
    textToAnalyze = currentContext.value?.selectedText || ''
  } else if (contextSource.value === 'page') {
    textToAnalyze = currentContext.value?.pageText || ''
  } else {
    textToAnalyze = directInputText.value
  }

  if (!textToAnalyze.trim() && attachedImages.value.length === 0) {
    showStatus($t('noInputToAnalyze'), 'error')
    return
  }

  isLoading.value = true
  resultText.value = ''
  showStatus($t('analyzingProgress'), 'success')

  try {
    await executeSummarizeRequest(textToAnalyze, true)
  } catch (err: any) {
    showStatus($t('serverConnectionFailed') + (err?.message || ''), 'error')
  } finally {
    isLoading.value = false
  }
}

const applyToInput = async (isRetry = false) => {
  if (!resultText.value) return

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (!tab || !tab.id) {
      showStatus($t('noActiveTab'), 'error')
      return
    }

    if (isRestrictedWebUrl(tab.url)) {
      showStatus($t('autofillRestrictedUrl'), 'error')
      return
    }

    chrome.tabs.sendMessage(
      tab.id,
      {
        action: 'injectText',
        text: resultText.value
      },
      async (response) => {
        if (chrome.runtime.lastError) {
          if (!isRetry) {
            const injected = await ensureContentScriptInjected(tab.id!)
            if (injected) {
              if (injectRetryTimer !== null) {
                clearTimeout(injectRetryTimer)
              }
              injectRetryTimer = setTimeout(() => {
                injectRetryTimer = null
                applyToInput(true)
              }, 100)
              return
            }
          }
          showStatus($t('autofillRestrictedUrl'), 'error')
          return
        }

        if (response && response.success) {
          showStatus($t('autofillSuccess'), 'success')
        } else {
          showStatus(response?.error || $t('autofillNoFocus'), 'error')
        }
      }
    )
  } catch (err: any) {
    showStatus($t('injectionError') + (err?.message || ''), 'error')
  }
}

const loadFallbackModels = () => {
  models.value = [
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', desc: $t('fallbackModel37FlashDesc'), isDefault: true },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', desc: $t('fallbackModel35FlashDesc'), isDefault: false },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Preview)', desc: $t('fallbackModel31ProDesc'), isDefault: false },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: $t('fallbackModel25FlashDesc'), isDefault: false }
  ]
  const defaultModel = models.value.find((m) => m.isDefault) || models.value[0]
  const isSavedModelValid = models.value.some((m) => m.id === selectedModel.value)
  selectedModel.value = isSavedModelValid && selectedModel.value ? selectedModel.value : defaultModel.id
}

const fetchModels = async () => {
  try {
    const response = await fetchWithFallback('/api/gemini/models')
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }
    const body = await response.json()
    if (body && body.success && Array.isArray(body.data) && body.data.length > 0) {
      models.value = body.data
      const defaultModel = body.data.find((m: GeminiModel) => m.isDefault) || body.data[0]
      const isSavedModelValid = body.data.some((m: GeminiModel) => m.id === selectedModel.value)
      selectedModel.value = isSavedModelValid && selectedModel.value ? selectedModel.value : defaultModel.id
    } else {
      loadFallbackModels()
    }
  } catch (err) {
    console.error('모델 목록 로드 에러, 폴백 모델 로드:', err)
    loadFallbackModels()
  }
}

const checkBackendConnection = async () => {
  try {
    const response = await fetchWithFallback('/v3/api-docs', { method: 'GET' })
    connectionStatus.value = response.ok ? 'connected' : 'error'
  } catch {
    connectionStatus.value = 'error'
  }
}

const handleTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
  fetchPageContent(activeInfo.tabId)
}

const handleTabUpdated = (
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
) => {
  if ((changeInfo.status === 'complete' || changeInfo.url) && tab.active) {
    fetchPageContent(tabId)
  }
}

const handleRuntimeMessage = (message: any) => {
  if (message && message.action === 'selectionChanged') {
    if (currentContext.value) {
      currentContext.value.selectedText = message.selectedText
    } else {
      currentContext.value = {
        selectedText: message.selectedText,
        pageText: '',
        title: ''
      }
    }
    if (message.selectedText && contextSource.value !== 'direct') {
      contextSource.value = 'selection'
    }
  }
}

onMounted(() => {
  if (typeof chrome !== 'undefined' && chrome.identity) {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        userToken.value = token
        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && data.email) {
              userEmail.value = data.email
              localStorage.setItem('userEmail', data.email)
            }
          })
          .catch((err) => console.error('자동 로그인 사용자 정보 조회 실패:', err))
      }
    })
  }

  promptText.value = $t('presetSummaryPrompt')

  checkBackendConnection()
  fetchModels()
  fetchPageContent()

  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
    chrome.tabs.onActivated.addListener(handleTabActivated)
    chrome.tabs.onUpdated.addListener(handleTabUpdated)
    chrome.runtime.onMessage.addListener(handleRuntimeMessage)
  }
})

onUnmounted(() => {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime) {
    chrome.tabs.onActivated.removeListener(handleTabActivated)
    chrome.tabs.onUpdated.removeListener(handleTabUpdated)
    chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
  }

  if (statusTimer !== null) {
    clearTimeout(statusTimer)
    statusTimer = null
  }
  if (captureCooldownTimer !== null) {
    clearTimeout(captureCooldownTimer)
    captureCooldownTimer = null
  }
  if (contentRetryTimer !== null) {
    clearTimeout(contentRetryTimer)
    contentRetryTimer = null
  }
  if (injectRetryTimer !== null) {
    clearTimeout(injectRetryTimer)
    injectRetryTimer = null
  }

  clearAttachedImages()
})
</script>

<template>
  <div class="app-container">
    <AppHeader
      :theme-mode="themeMode"
      :connection-status="connectionStatus"
      :user-email="userEmail"
      @update:theme-mode="setThemeMode"
      @logout="logout"
    />

    <main v-if="userEmail" class="main-content">
      <ModelSelector
        v-model="selectedModel"
        :models="models"
      />

      <SourceDashboard
        v-model:context-source="contextSource"
        v-model:direct-input-text="directInputText"
        :current-context="currentContext"
        :text-metrics="textMetrics"
        :extracted-keywords="extractedKeywords"
        @refresh="fetchPageContent()"
      />

      <PromptSection
        v-model="promptText"
        :presets="presets"
        :attachments="attachedImages"
        :max-attachments="MAX_ATTACHED_IMAGES"
        :can-capture="isTabCapturable"
        :is-capturing="isCapturing"
        :is-disabled="isLoading || isCaptureCooldown"
        @capture="captureCurrentTab"
        @paste-images="handlePasteImages"
        @remove-attachment="removeAttachedImage"
        @clear-attachments="clearAttachedImages"
        @submit="generateAIResult"
      />

      <button
        type="button"
        class="generate-btn"
        :disabled="!canGenerate"
        @click="generateAIResult"
      >
        <span v-if="!isLoading">{{ $t('generateBtn') }}</span>
        <span v-else class="loader-container">
          <span class="spinner"></span>
          {{ $t('generatingState') }}
        </span>
      </button>

      <ResultSection
        v-model:result-text="resultText"
        v-model:is-editing="isEditing"
        :is-loading="isLoading"
        @apply="applyToInput()"
        @copy-error="showStatus($t('copyFailed'), 'error')"
      />
    </main>

    <LoginSection
      v-else
      :is-login-loading="isLoginLoading"
      @login="loginWithGoogle"
    />

    <div v-if="statusMessage" class="toast" :class="statusType">
      {{ statusMessage }}
    </div>
  </div>
</template>

<style src="./App.css"></style>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import AppHeader from './components/AppHeader.vue'
import LoginSection from './components/LoginSection.vue'
import ModelSelector from './components/ModelSelector.vue'
import SourceDashboard from './components/SourceDashboard.vue'
import PromptSection from './components/PromptSection.vue'
import ResultSection from './components/ResultSection.vue'

interface ExtensionContent {
  selectedText: string
  pageText: string
  title: string
}

interface GeminiModel {
  id: string
  name: string
  desc: string
}

// 다국어 번역 헬퍼 함수
const $t = (key: string): string => {
  if (typeof chrome !== 'undefined' && chrome.i18n) {
    return chrome.i18n.getMessage(key) || key
  }
  return key
}

const models = ref<GeminiModel[]>([])
const selectedModel = ref('gemini-3.5-flash')
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

// 소스 탭 전환 시 텍스트 실시간 비동기 갱신
watch(contextSource, (newSource) => {
  if (newSource === 'page' || newSource === 'selection') {
    fetchPageContent()
  }
})

// 구글 로그인 관련 세션 변수
const userEmail = ref<string | null>(localStorage.getItem('userEmail'))
const userToken = ref<string | null>(null)
const isLoginLoading = ref(false)

// 테마 상태 및 브라우저 미디어 쿼리 감지
const isDarkMode = ref(true)
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

const applyTheme = (isDark: boolean) => {
  isDarkMode.value = isDark
  document.documentElement.classList.toggle('light-theme', !isDark)
}

const toggleTheme = () => {
  const nextDark = !isDarkMode.value
  applyTheme(nextDark)
  localStorage.setItem('theme', nextDark ? 'dark' : 'light')
}

const handleSystemThemeChange = (e: MediaQueryListEvent) => {
  if (!localStorage.getItem('theme')) {
    applyTheme(e.matches)
  }
}

const showRawText = ref(false)

const textMetrics = computed(() => {
  const text = contextSource.value === 'selection' 
    ? currentContext.value?.selectedText 
    : currentContext.value?.pageText

  if (!text) return { length: 0, words: 0, byteSize: '0 B', readTime: 0 }

  const length = text.length
  const words = text.trim().split(/\s+/).filter(Boolean).length

  const encoder = new TextEncoder()
  const bytes = encoder.encode(text).length
  let byteSize = bytes + ' B'
  if (bytes > 1024 * 1024) {
    byteSize = (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  } else if (bytes > 1024) {
    byteSize = (bytes / 1024).toFixed(1) + ' KB'
  }

  const readTime = Math.max(1, Math.ceil(length / 500))

  return { length, words, byteSize, readTime }
})

const extractedKeywords = computed(() => {
  const text = contextSource.value === 'selection' 
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

  words.forEach(word => {
    const lower = word.toLowerCase()
    if (!stopWords.has(lower) && isNaN(Number(lower))) {
      freqMap[lower] = (freqMap[lower] || 0) + 1
    }
  })

  return Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(entry => entry[0])
})


const presets = computed(() => [
  { label: $t('presetSummaryLabel'), prompt: $t('presetSummaryPrompt') },
  { label: $t('presetReportLabel'), prompt: $t('presetReportPrompt') },
  { label: $t('presetEmailLabel'), prompt: $t('presetEmailPrompt') },
  { label: $t('presetBugLabel'), prompt: $t('presetBugPrompt') }
])

const applyPreset = (presetPrompt: string) => {
  promptText.value = presetPrompt
}

// 구글 소셜 로그인 처리
const loginWithGoogle = () => {
  isLoginLoading.value = true
  if (typeof chrome !== 'undefined' && chrome.identity) {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.error("구글 로그인 실패:", chrome.runtime.lastError)
        showStatus("구글 로그인에 실패했습니다. Client ID 설정을 확인해 주세요.", "error")
        isLoginLoading.value = false
        return
      }
      userToken.value = token
      
      // 토큰으로 구글 프로필 정보 가져오기 (이메일 확인용)
      fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.email) {
          userEmail.value = data.email
          localStorage.setItem('userEmail', data.email)
          showStatus("로그인에 성공했습니다!", "success")
        }
      })
      .catch(err => {
        console.error("구글 사용자 정보 획득 실패:", err)
        showStatus("사용자 정보 조회 실패", "error")
      })
      .finally(() => {
        isLoginLoading.value = false
      })
    })
  } else {
    isLoginLoading.value = false
  }
}

// 구글 로그아웃 처리
const logout = () => {
  if (userToken.value && typeof chrome !== 'undefined' && chrome.identity) {
    chrome.identity.removeCachedAuthToken({ token: userToken.value }, () => {
      userToken.value = null
      userEmail.value = null
      localStorage.removeItem('userEmail')
      showStatus("로그아웃 되었습니다.", "success")
    })
  } else {
    userToken.value = null
    userEmail.value = null
    localStorage.removeItem('userEmail')
    showStatus("로그아웃 되었습니다.", "success")
  }
}

// 컨텐트 스크립트 동적 주입 함수
const ensureContentScriptInjected = async (tabId: number): Promise<boolean> => {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (tab && tab.url) {
      const url = tab.url
      // 일반 웹페이지(http/https)가 아닌 모든 시스템/보안 특수 페이지는 주입 불가로 차단
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return false
      }
      if (url.startsWith('https://chromewebstore.google.com')) {
        return false
      }
    }
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    })
    return true
  } catch (err: any) {
    console.error("컨텐트 스크립트 동적 주입 실패:", err)
    return false
  }
}

// 웹페이지 콘텐츠 정보 가져오기
const fetchPageContent = async (specificTabId?: number, retryCount = 0) => {
  try {
    let tabId = specificTabId
    if (!tabId) {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
      if (!tab || !tab.id) {
        return
      }
      tabId = tab.id
    }

    // 시스템 주소 가드 및 리셋
    const currentTab = await chrome.tabs.get(tabId)
    if (currentTab && currentTab.url) {
      const url = currentTab.url
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        currentContext.value = null
        return
      }
      if (url.startsWith('https://chromewebstore.google.com')) {
        currentContext.value = null
        return
      }
    }

    chrome.tabs.sendMessage(tabId, { action: "getPageContent" }, async (response) => {
      if (chrome.runtime.lastError) {
        // 통신 오류 감지 시 5회 한도로 스크립트 재주입 및 지연 재시도 (총 5초 대기)
        if (retryCount < 5) {
          const injected = await ensureContentScriptInjected(tabId!)
          if (!injected) {
            currentContext.value = null
            return
          }
          setTimeout(() => {
            fetchPageContent(tabId, retryCount + 1)
          }, 1000)
        } else {
          currentContext.value = null
        }
        return
      }

      if (response) {
        currentContext.value = response
      }
    })
  } catch (err: any) {
    console.error("페이지 정보 획득 실패:", err)
  }
}

// 제미나이 API 호출 및 결과 생성
const generateAIResult = async () => {
  if (contextSource.value !== 'direct' && !currentContext.value) {
    await fetchPageContent()
    if (!currentContext.value) return
  }

  let textToAnalyze = ""
  if (contextSource.value === 'selection') {
    textToAnalyze = currentContext.value?.selectedText || ""
  } else if (contextSource.value === 'page') {
    textToAnalyze = currentContext.value?.pageText || ""
  } else if (contextSource.value === 'direct') {
    textToAnalyze = directInputText.value
  }

  if (!textToAnalyze) {
    showStatus($t('noTextToAnalyze'), "error")
    return
  }

  isLoading.value = true
  resultText.value = ""
  showStatus($t('analyzingProgress'), "success")

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    }
    if (userToken.value) {
      headers["Authorization"] = `Bearer ${userToken.value}`
    }

    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/gemini/summarize`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: textToAnalyze,
        prompt: promptText.value,
        model: selectedModel.value
      })
    })

    if (!response.body) {
      showStatus("응답 스트림을 수신할 수 없습니다.", "error")
      isLoading.value = false
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder("utf-8")
    resultText.value = ""
    isEditing.value = false
    isLoading.value = false

    let hasError = false
    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      if (chunk.startsWith("ERROR:")) {
        showStatus(chunk.substring(6).trim(), "error")
        resultText.value = ""
        hasError = true
        break
      }
      resultText.value += chunk
    }

    if (hasError) return

    showStatus($t('generationSuccess'), "success")
  } catch (err: any) {
    showStatus($t('serverConnectionFailed') + err.message, "error")
  } finally {
    isLoading.value = false
  }
}

// 요약된 결과를 웹페이지의 포커스된 입력창에 적용
const applyToInput = async () => {
  if (!resultText.value) return

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (!tab || !tab.id) {
      showStatus($t('noActiveTab'), "error")
      return
    }

    chrome.tabs.sendMessage(tab.id, { 
      action: "injectText", 
      text: resultText.value 
    }, async (response) => {
      if (chrome.runtime.lastError) {
        // 주입 오류 감지 시에도 동적 주입 후 재시도
        const injected = await ensureContentScriptInjected(tab.id!)
        if (injected) {
          setTimeout(() => {
            applyToInput()
          }, 100)
        } else {
          showStatus("크롬 시스템 페이지 또는 웹스토어에는 자동 입력을 지원하지 않습니다.", "error")
        }
        return
      }

      if (response && response.success) {
        showStatus($t('autofillSuccess'), "success")
      } else {
        showStatus(response?.error || $t('autofillNoFocus'), "error")
      }
    })
  } catch (err: any) {
    showStatus($t('injectionError') + err.message, "error")
  }
}

// 백엔드로부터 구글 Gemini 실시간 제공 모델 목록 조회
const fetchModels = async () => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/gemini/models`)
    const body = await response.json()
    if (body && body.success && body.data && body.data.length > 0) {
      models.value = body.data
      const hasDefaultModel = body.data.some((m: GeminiModel) => m.id === 'gemini-3.5-flash')
      selectedModel.value = hasDefaultModel ? 'gemini-3.5-flash' : body.data[0].id
    } else {
      loadFallbackModels()
    }
  } catch (err) {
    console.error("모델 목록 로드 에러, 폴백 모델 로드:", err)
    loadFallbackModels()
  }
}

const loadFallbackModels = () => {
  models.value = [
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', desc: '초고속 차세대 대형 언어 모델 (추천)' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Preview)', desc: '제미나이 3.1 고성능 분석 모델' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: '안정적인 고속 분석 모델' }
  ]
  selectedModel.value = 'gemini-3.5-flash'
}

// 스프링 백엔드 연결 상태 체크
const checkBackendConnection = async () => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/v3/api-docs`, { method: "GET" })
    if (response.ok) {
      connectionStatus.value = 'connected'
    } else {
      connectionStatus.value = 'error'
    }
  } catch {
    connectionStatus.value = 'error'
  }
}

const showStatus = (msg: string, type: 'success' | 'error') => {
  statusMessage.value = msg
  statusType.value = type
  setTimeout(() => {
    if (statusMessage.value === msg) {
      statusMessage.value = ""
      statusType.value = ""
    }
  }, 4000)
}

onMounted(() => {
  // 구글 로그인 자동 세션 확인
  if (typeof chrome !== 'undefined' && chrome.identity) {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        userToken.value = token
        fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
          if (data && data.email) {
            userEmail.value = data.email
            localStorage.setItem('userEmail', data.email)
          }
        })
        .catch(err => console.error("자동 로그인 사용자 정보 조회 실패:", err))
      }
    })
  }

  // 기본 프롬프트 다국어 로드
  promptText.value = $t('presetSummaryPrompt')

  // 테마 초기화
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme) {
    applyTheme(savedTheme === 'dark')
  } else {
    applyTheme(mediaQuery.matches)
  }
  mediaQuery.addEventListener('change', handleSystemThemeChange)

  checkBackendConnection()
  fetchModels()
  fetchPageContent()

  // 탭이 활성화되거나 변경될 때 자동으로 해당 페이지 콘텐츠 로드
  chrome.tabs.onActivated.addListener((activeInfo) => {
    fetchPageContent(activeInfo.tabId)
  })

  // 탭 내부의 페이지 로딩이 완료될 때 콘텐츠 다시 로드
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, _tab) => {
    if (changeInfo.status === 'complete') {
      fetchPageContent(tabId)
    }
  })

  // 콘텐츠 스크립트로부터 드래그 영역 실시간 감지 수신
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "selectionChanged") {
      if (currentContext.value) {
        currentContext.value.selectedText = message.selectedText
        if (message.selectedText && contextSource.value !== 'direct') {
          contextSource.value = 'selection'
        }
      } else {
        // 컨텍스트가 초기화 전인 경우 새로 구성
        currentContext.value = {
          selectedText: message.selectedText,
          pageText: '',
          title: ''
        }
        if (message.selectedText && contextSource.value !== 'direct') {
          contextSource.value = 'selection'
        }
      }
    }
    return true
  })
})

onUnmounted(() => {
  mediaQuery.removeEventListener('change', handleSystemThemeChange)
})
</script>

<template>
  <div class="app-container">
    <AppHeader 
      :is-dark-mode="isDarkMode"
      :connection-status="connectionStatus"
      :user-email="userEmail"
      @toggle-theme="toggleTheme"
      @logout="logout"
    />

    <!-- 로그인 완료 상태 (사이드패널 기능 활성화) -->
    <main class="main-content" v-if="userEmail">
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
      />

      <PromptSection 
        v-model="promptText"
        :presets="presets"
      />

      <!-- 생성 버튼 -->
      <button 
        class="generate-btn" 
        :disabled="isLoading || (contextSource === 'selection' && currentContext && !currentContext.selectedText) || (contextSource === 'direct' && !directInputText)"
        @click="generateAIResult"
      >
        <span v-if="!isLoading" class="glow-text">{{ $t('generateBtn') }}</span>
        <span v-else class="loader-container">
          <span class="spinner"></span>
          {{ $t('generatingState') }}
        </span>
      </button>

      <ResultSection 
        v-model:result-text="resultText"
        v-model:is-editing="isEditing"
        :is-loading="isLoading"
        @apply="applyToInput"
      />
    </main>

    <!-- 로그인 유도 레이아웃 -->
    <LoginSection 
      v-else
      :is-login-loading="isLoginLoading"
      @login="loginWithGoogle"
    />

    <!-- 하단 상태 토스트 알림 -->
    <div class="toast" :class="statusType" v-if="statusMessage">
      {{ statusMessage }}
    </div>
  </div>
</template>

<style src="./App.css"></style>

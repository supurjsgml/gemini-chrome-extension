<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

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
      if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('https://chromewebstore.google.com')) {
        console.warn("크롬 보안 정책상 시스템 주소 또는 웹스토어에는 스크립트 주입이 불가합니다:", url)
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
const fetchPageContent = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab || !tab.id) {
      showStatus($t('noActiveTab'), "error")
      return
    }

    chrome.tabs.sendMessage(tab.id, { action: "getPageContent" }, async (response) => {
      if (chrome.runtime.lastError) {
        // 통신 오류 감지 시 동적 주입 후 1회 재시도 시도
        const injected = await ensureContentScriptInjected(tab.id!)
        if (injected) {
          setTimeout(() => {
            fetchPageContent()
          }, 100)
        } else {
          showStatus("크롬 시스템 페이지 또는 웹스토어에서는 텍스트 분석을 시작할 수 없습니다.", "error")
          currentContext.value = null
        }
        return
      }

      if (response) {
        currentContext.value = response
        contextSource.value = response.selectedText ? 'selection' : 'page'
      }
    })
  } catch (err: any) {
    showStatus($t('failedToReadPage') + ": " + err.message, "error")
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

    const body = await response.json()
    if (body && body.success) {
      resultText.value = body.data.result
      isEditing.value = false
      showStatus($t('generationSuccess'), "success")
    } else {
      showStatus(body?.message || $t('backendError'), "error")
    }
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
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
  chrome.tabs.onActivated.addListener(() => {
    fetchPageContent()
  })

  // 탭 내부의 페이지 로딩이 완료될 때 콘텐츠 다시 로드
  chrome.tabs.onUpdated.addListener((_tabId, changeInfo, _tab) => {
    if (changeInfo.status === 'complete') {
      fetchPageContent()
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
    <!-- 헤더 영역 -->
    <header class="header">
      <div class="brand">
        <div class="logo-glow"></div>
        <svg class="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" fill="url(#geminiGrad)" />
          <defs>
            <linearGradient id="geminiGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#8a2be2" />
              <stop offset="50%" stop-color="#4169e1" />
              <stop offset="100%" stop-color="#00ffff" />
            </linearGradient>
          </defs>
        </svg>
        <h1 class="title">Gemini Agent</h1>
      </div>
      <div class="header-actions">
        <!-- 테마 토글 버튼 -->
        <button @click="toggleTheme" class="theme-toggle-btn" :title="isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'">
          <svg v-if="isDarkMode" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="4.22" x2="19.78" y2="5.64"></line>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>
        <div class="status-badge" :class="connectionStatus">
          <span class="pulse-dot"></span>
          <span class="status-text">
            {{ connectionStatus === 'connected' ? $t('statusConnected') : connectionStatus === 'error' ? $t('statusDisconnected') : $t('statusConnecting') }}
          </span>
        </div>
        
        <!-- 사용자 세션 & 로그아웃 -->
        <div class="user-profile-badge" v-if="userEmail">
          <span class="user-email" :title="userEmail">{{ userEmail.split('@')[0] }}</span>
          <button @click="logout" class="logout-btn" title="로그아웃">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="logout-icon">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- 미로그인 상태 (구글 로그인 유도 화면) -->
    <div v-if="!userEmail" class="login-container">
      <div class="login-card">
        <div class="logo-large-wrapper">
          <div class="logo-glow-large"></div>
          <svg class="logo-icon-large" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" fill="url(#geminiGradLarge)" />
            <defs>
              <linearGradient id="geminiGradLarge" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#8a2be2" />
                <stop offset="50%" stop-color="#4169e1" />
                <stop offset="100%" stop-color="#00ffff" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h2 class="welcome-title">Gemini AI Web Agent</h2>
        <p class="welcome-desc">웹페이지를 실시간으로 요약 및 자동 작성하고, 일일 사용 한도를 안전하게 지원받기 위해 구글 로그인이 필요합니다.</p>
        
        <button class="login-btn" :disabled="isLoginLoading" @click="loginWithGoogle">
          <span v-if="!isLoginLoading" class="login-btn-content">
            <svg class="google-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Google 계정으로 계속하기
          </span>
          <span v-else class="loader-container">
            <span class="spinner"></span>
            로그인 중...
          </span>
        </button>
      </div>
    </div>

    <!-- 로그인 완료 상태 (사이드패널 기능 활성화) -->
    <main class="main-content" v-else>
      <!-- 모델 선택 -->
      <section class="section">
        <label class="section-label">{{ $t('modelLabel') }}</label>
        <div class="select-wrapper">
          <select v-model="selectedModel" class="custom-select">
            <option v-for="model in models" :key="model.id" :value="model.id">
              {{ model.name }}
            </option>
          </select>
          <div class="select-desc">
            {{ models.find(m => m.id === selectedModel)?.desc }}
          </div>
        </div>
      </section>

      <!-- 컨텍스트 소스 범위 지정 -->
      <section class="section">
        <label class="section-label">{{ $t('sourceLabel') }}</label>
        <div class="tab-group">
          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: contextSource === 'selection' }" 
            :disabled="!currentContext?.selectedText"
            @click="contextSource = 'selection'"
          >
            {{ $t('sourceSelection') }}
          </button>
          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: contextSource === 'page' }" 
            @click="contextSource = 'page'"
          >
            {{ $t('sourcePage') }}
          </button>
          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: contextSource === 'direct' }" 
            @click="contextSource = 'direct'"
          >
            {{ $t('sourceDirect') }}
          </button>
        </div>

        <div v-if="contextSource === 'direct'" class="direct-input-wrapper">
          <textarea 
            v-model="directInputText" 
            class="custom-textarea" 
            style="margin-top: 10px; min-height: 90px;"
            :placeholder="$t('directInputPlaceholder')"
          ></textarea>
        </div>
        <div v-else class="context-preview">
          <p class="preview-text" v-if="contextSource === 'selection' && currentContext?.selectedText">
            "{{ currentContext.selectedText.substring(0, 120) }}{{ currentContext.selectedText.length > 120 ? '...' : '' }}"
          </p>
          <p class="preview-text text-muted" v-else-if="contextSource === 'selection' && !currentContext?.selectedText">
            {{ $t('noSelectionText') }}
          </p>
          <p class="preview-text" v-else-if="currentContext?.pageText">
            "{{ currentContext.pageText.substring(0, 120) }}{{ currentContext.pageText.length > 120 ? '...' : '' }}"
          </p>
          <p class="preview-text text-muted" v-else>
            {{ $t('noPageText') }}
          </p>
        </div>
      </section>

      <!-- 프롬프트 지시사항 -->
      <section class="section">
        <label class="section-label">{{ $t('promptLabel') }}</label>
        <textarea 
          v-model="promptText" 
          class="custom-textarea" 
          :placeholder="$t('promptPlaceholder')"
        ></textarea>
        
        <!-- 프리셋 선택 -->
        <div class="preset-chips">
          <button 
            v-for="preset in presets" 
            :key="preset.label" 
            class="chip-btn"
            @click="applyPreset(preset.prompt)"
          >
            {{ preset.label }}
          </button>
        </div>
      </section>

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

      <!-- 결과 프리뷰 & 주입 기능 -->
      <section class="section result-section" v-if="resultText || isLoading">
        <div class="result-header">
          <label class="section-label">{{ $t('resultPreviewLabel') }}</label>
          <button 
            v-if="resultText && !isLoading" 
            class="edit-toggle-btn"
            @click="isEditing = !isEditing"
          >
            {{ isEditing ? $t('editToggleDone') : $t('editToggleEdit') }}
          </button>
        </div>
        
        <div class="result-container" :class="{ loading: isLoading }">
          <textarea 
            v-if="isEditing" 
            v-model="resultText" 
            class="result-textarea"
          ></textarea>
          <div v-else class="result-display">
            {{ resultText }}
          </div>
        </div>

        <button 
          v-if="resultText && !isLoading"
          class="apply-btn" 
          @click="applyToInput"
        >
          {{ $t('applyBtn') }}
        </button>
      </section>
    </main>

    <!-- 하단 상태 토스트 알림 -->
    <div class="toast" :class="statusType" v-if="statusMessage">
      {{ statusMessage }}
    </div>
  </div>
</template>

<style src="./App.css"></style>

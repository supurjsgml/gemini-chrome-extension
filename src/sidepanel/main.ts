import { createApp } from 'vue'
import App from './App.vue'
import { initThemeBeforeMount } from './composables/useTheme'

initThemeBeforeMount()
createApp(App).mount('#app')

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import fs from 'fs'

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  const outDir = isDev ? 'dist_dev' : 'dist'

  return {
    plugins: [
      vue(),
      {
        name: 'manifest-client-id-replace',
        closeBundle() {
          const targetManifest = resolve(__dirname, `${outDir}/manifest.json`)
          const secretsPath = resolve(__dirname, 'secrets.json')
          
          if (fs.existsSync(targetManifest)) {
            let content = fs.readFileSync(targetManifest, 'utf-8')
            let targetId = '__GOOGLE_CLIENT_ID__'

            if (fs.existsSync(secretsPath)) {
              try {
                const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'))
                targetId = isDev 
                  ? secrets.GOOGLE_CLIENT_ID_DEV 
                  : secrets.GOOGLE_CLIENT_ID_PROD
              } catch (e) {
                console.warn('[Vite Plugin] Failed to parse secrets.json:', e)
              }
            } else {
              console.warn('[Vite Plugin] secrets.json not found. Keeping placeholder.')
            }

            content = content.replace(/__GOOGLE_CLIENT_ID__/g, targetId)
            fs.writeFileSync(targetManifest, content, 'utf-8')
            console.log(`[Vite Plugin] manifest.json client_id replaced for ${mode} mode: ${targetId}`)
          }
        }
      }
    ],
    build: {
      rollupOptions: {
        input: {
          sidepanel: resolve(__dirname, 'sidepanel.html'),
          background: resolve(__dirname, 'src/background/background.ts'),
          content: resolve(__dirname, 'src/content/content.ts'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        }
      },
      outDir: outDir,
      emptyOutDir: true,
    }
  }
})

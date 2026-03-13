import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const ytUrl = env.VITE_YT_URL || 'https://bitacora.youtrack.cloud'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/yt-api': {
          target: ytUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/yt-api/, '/api'),
          secure: true,
        },
        '/openai-api': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/openai-api/, ''),
          secure: true,
        },
      },
    },
  }
})

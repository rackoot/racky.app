import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  // Determine if we're running in Docker based on environment or fallback
  const isDocker = env.DOCKER_ENV === 'true' || env.VITE_BACKEND_URL?.includes('backend')
  const backendUrl = isDocker ? 'http://backend:5000' : (env.VITE_BACKEND_URL || 'http://localhost:5000')
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      watch: {
        usePolling: true,
      },
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Enable optimization with memory-conscious settings
    include: [
      'cookie',
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
    ],
    esbuildOptions: {
      target: 'es2020',
      logLevel: 'info',
    },
    // Don't wait for all deps to be discovered before starting server
    holdUntilCrawlEnd: false,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: [
      'dev-suite.racky.ai',
      'localhost',
      '.racky.ai', // Allow all racky.ai subdomains
    ],
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        // In Kubernetes, both containers are in the same pod, so use localhost
        // In Docker Compose, use the service name 'backend'
        // VITE_BACKEND_URL can override for custom environments
        target: process.env.VITE_BACKEND_URL || (process.env.DOCKER_ENV ? 'http://backend:5000' : 'http://localhost:5000'),
        changeOrigin: true,
        secure: false, // Allow self-signed certificates in dev
      },
      '/internal': {
        // Proxy webhook endpoints from external services (e.g., RCK Description Server)
        target: process.env.VITE_BACKEND_URL || (process.env.DOCKER_ENV ? 'http://backend:5000' : 'http://localhost:5000'),
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

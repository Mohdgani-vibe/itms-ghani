import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const backendTarget = 'http://localhost:3001'
const backendWsTarget = 'ws://localhost:3001'
const proxy = {
  '/api': {
    target: backendTarget,
    changeOrigin: true,
  },
  '/ws': {
    target: backendWsTarget,
    ws: true,
    changeOrigin: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')),
  },
  build: {
    target: 'es2018',
  },
  resolve: {
    alias: {
      html2canvas: fileURLToPath(new URL('./src/lib/vendor/html2canvas-stub.ts', import.meta.url)),
      dompurify: fileURLToPath(new URL('./src/lib/vendor/dompurify-stub.ts', import.meta.url)),
    },
  },
  server: {
    proxy,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  },
  preview: {
    proxy,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  },
})

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  appType: 'spa',
  plugins: [react(), tailwindcss()],
  server: {
    // スマホから ngrok 経由でアクセスするため、NGROK_DOMAIN（ホスト名のみ）を許可する。
    allowedHosts: process.env.NGROK_DOMAIN ? [process.env.NGROK_DOMAIN] : [],
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.{ts,tsx}'],
  },
})

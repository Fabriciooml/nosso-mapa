import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 1996,
    proxy: {
      '/api': 'http://localhost:2000',
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})

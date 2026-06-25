import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In local dev, proxy /api to the backend so the frontend can call it without CORS pain.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})

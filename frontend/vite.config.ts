import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // When the Spring Boot backend exists, same-origin /api calls are forwarded to it,
    // so cookies and the CSRF token work without cross-site configuration in development.
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})

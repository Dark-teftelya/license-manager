// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ← Вот так правильно! Только import, никаких require()
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  plugins: [react()],

  css: {
    postcss: {
      plugins: [
        tailwindcss(),     // ← с круглыми скобками!
        autoprefixer(),    // ← тоже с круглыми скобками!
      ],
    },
  },

  server: {
    host: true,        // ← вместо --host в команде
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Multi-page build: the public site (index.html) and the tournament-ops admin
// panel (admin.html) are separate HTML entry points / URLs, sharing the same
// React + Tailwind toolchain and the lib/sheet.js data pipeline — but the
// admin bundle is never linked from or shipped inside the public site.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
})
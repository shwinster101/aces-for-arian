import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Build↔commit traceability: stamp the deploying commit into a <meta> on BOTH
// HTML entry points. Cloudflare Pages exposes CF_PAGES_COMMIT_SHA at build
// time (GITHUB_SHA covers CI builds; 'dev' locally), so the check-deploy
// workflow can assert live-site sha === expected commit instead of grepping a
// copy-string "freshness marker" out of the bundle.
const buildShaMeta = () => ({
  name: 'build-sha-meta',
  transformIndexHtml() {
    const sha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || 'dev'
    return [{ tag: 'meta', attrs: { name: 'build-sha', content: sha }, injectTo: 'head' }]
  },
})

// Multi-page build: the public site (index.html) and the tournament-ops admin
// panel (admin.html) are separate HTML entry points / URLs, sharing the same
// React + Tailwind toolchain and the lib/sheet.js data pipeline — but the
// admin bundle is never linked from or shipped inside the public site.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    buildShaMeta(),
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
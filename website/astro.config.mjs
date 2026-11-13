import { defineConfig } from 'astro/config'

// GitHub Pages proje sitesi: https://ugurshelby.github.io/prism/
export default defineConfig({
  site: 'https://ugurshelby.github.io',
  base: '/prism',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  // Keep scripts as separate files; the page CSP does not allow inline scripts.
  vite: { build: { assetsInlineLimit: 0 } }
})

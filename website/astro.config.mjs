import { defineConfig } from 'astro/config'

// GitHub Pages proje sitesi: https://ugurshelby.github.io/prism/
export default defineConfig({
  site: 'https://ugurshelby.github.io',
  base: '/prism',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  i18n: {
    locales: ['en', 'tr'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false }
  },
  // Betikler ayrı dosya olarak kalsın; sayfadaki CSP satır içi betiğe izin vermiyor.
  vite: { build: { assetsInlineLimit: 0 } }
})

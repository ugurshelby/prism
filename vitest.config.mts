import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Birim testleri yalnızca Electron'a bağlı olmayan modülleri kapsar (şemalar, saf yardımcılar, ağ katmanı).
export default defineConfig({
  resolve: { alias: { '@shared': resolve('src/shared') } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
})

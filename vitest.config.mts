import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Unit tests cover only modules that do not depend on Electron (schemas, pure helpers, network layer).
export default defineConfig({
  resolve: { alias: { '@shared': resolve('src/shared'), '@products': resolve('src/products') } },
  define: { __PRISM_PRODUCT__: JSON.stringify('spectrum') },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
})

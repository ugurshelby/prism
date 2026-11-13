import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { knowledgeManifest } from './scripts/knowledge-manifest.mjs'

const shared = { '@shared': resolve('src/shared'), '@products': resolve('src/products') }

// The product is chosen at build time and validated in src/shared/product.ts.
// A build must name the product (`npm run build:ray`, `build:spectrum`) so a missing value never packages the
// wrong product silently. Only the dev server (`npm run dev`) defaults to Spectrum.
export default defineConfig(({ command }) => {
  const product = process.env.PRISM_PRODUCT || (command === 'serve' ? 'spectrum' : '')
  if (!['ray', 'spectrum'].includes(product)) throw new Error(`PRISM_PRODUCT missing or unknown: "${product}" (ray | spectrum)`)
  const define = { __PRISM_PRODUCT__: JSON.stringify(product) }
  // Builds pin every knowledge card by hash (src/main/engine/integrity.ts); the dev server reads cards as they are.
  const mainDefine = command === 'build' ? { ...define, __KNOWLEDGE_HASHES__: JSON.stringify(knowledgeManifest(resolve('knowledge'))) } : define
  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      resolve: { alias: shared },
      define: mainDefine
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      resolve: { alias: shared },
      define
    },
    renderer: {
      resolve: { alias: shared },
      plugins: [react()],
      define
    }
  }
})

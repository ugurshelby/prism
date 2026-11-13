import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = { '@shared': resolve('src/shared'), '@products': resolve('src/products') }

// The product is chosen at build time and validated in src/shared/product.ts.
// A build must name the product (`npm run build:ray`, `build:spectrum`) so a missing value never packages the
// wrong product silently. Only the dev server (`npm run dev`) defaults to Spectrum.
export default defineConfig(({ command }) => {
  const product = process.env.PRISM_PRODUCT || (command === 'serve' ? 'spectrum' : '')
  if (!['ray', 'spectrum'].includes(product)) throw new Error(`PRISM_PRODUCT missing or unknown: "${product}" (ray | spectrum)`)
  const define = { __PRISM_PRODUCT__: JSON.stringify(product) }
  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      resolve: { alias: shared },
      define
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

import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = { '@shared': resolve('src/shared'), '@products': resolve('src/products') }

// Hangi ürünün derleneceği build sırasında seçilir; değer src/shared/product.ts'te doğrulanır.
// Varsayılan Spectrum'dur (2.x kullanıcılarının ürünü); bilinmeyen değer derlemeyi durdurur.
const product = process.env.PRISM_PRODUCT || 'spectrum'
if (!['ray', 'spectrum'].includes(product)) throw new Error(`PRISM_PRODUCT bilinmiyor: ${product}`)
const define = { __PRISM_PRODUCT__: JSON.stringify(product) }

export default defineConfig({
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
})

import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = { '@shared': resolve('src/shared'), '@products': resolve('src/products') }

// Hangi ürünün derleneceği build sırasında seçilir; değer src/shared/product.ts'te doğrulanır.
// Derlemede ürün açıkça verilmelidir (`npm run build:ray`, `build:spectrum`): unutulan değer yanlış ürünü
// sessizce paketlemesin. Yalnızca geliştirme sunucusu (`npm run dev`) varsayılan olarak Spectrum'u açar.
export default defineConfig(({ command }) => {
  const product = process.env.PRISM_PRODUCT || (command === 'serve' ? 'spectrum' : '')
  if (!['ray', 'spectrum'].includes(product)) throw new Error(`PRISM_PRODUCT eksik ya da bilinmiyor: "${product}" (ray | spectrum)`)
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

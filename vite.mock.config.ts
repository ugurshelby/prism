// Develops the UI in a browser without Electron, using the mock bridge.
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'src/renderer',
  resolve: { alias: { '@shared': resolve('src/shared'), '@products': resolve('src/products') } },
  plugins: [react()],
  define: { __PRISM_PRODUCT__: JSON.stringify(process.env.PRISM_PRODUCT ?? 'spectrum') }
})

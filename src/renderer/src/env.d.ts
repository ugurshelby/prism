/// <reference types="vite/client" />

import 'react'

declare module 'react' {
  // Bileşenler renk tonunu --hue gibi CSS değişkenleriyle verir.
  interface CSSProperties {
    [variable: `--${string}`]: string | number | undefined
  }
}

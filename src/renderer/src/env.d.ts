/// <reference types="vite/client" />

import 'react'

declare module 'react' {
  // Components pass the color hue through CSS variables such as --hue.
  interface CSSProperties {
    [variable: `--${string}`]: string | number | undefined
  }
}

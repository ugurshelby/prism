// Prism'in okuduğu ortam değişkenlerinin tek kaynağı. Başka modül process.env'e doğrudan bakmaz.
// Geliştirme anahtarları (PRISM_*, ELECTRON_RENDERER_URL) kurulu sürümde yok sayılır: paketli uygulamanın
// davranışını ortamı değiştiren biri yönlendiremesin.

import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { PROVIDERS, PROVIDER_INFO } from '@shared/catalog'

const optional = z
  .string()
  .optional()
  .transform((v) => (v === '' ? undefined : v))

const DevSchema = z.object({
  PRISM_USER_DATA: optional,
  PRISM_CAPTURE: optional,
  PRISM_CAPTURE_PROMPT: optional,
  ELECTRON_RENDERER_URL: optional.pipe(z.url({ protocol: /^https?$/, hostname: /^(localhost|127\.0\.0\.1)$/ }).optional())
})

export interface DevEnv {
  userData?: string
  captureDir?: string
  capturePrompt?: string
  rendererUrl?: string
}

let dev: DevEnv | null = null

/** Yalnızca geliştirmede dolu; kurulu sürümde her zaman boş nesne. */
export function devEnv(): DevEnv {
  if (dev) return dev
  if (app.isPackaged) return (dev = {})
  const parsed = DevSchema.safeParse(process.env)
  if (!parsed.success) throw new Error(`[env] geliştirme ortam değişkenleri geçersiz: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`)
  const e = parsed.data
  return (dev = {
    userData: e.PRISM_USER_DATA,
    captureDir: e.PRISM_CAPTURE,
    capturePrompt: e.PRISM_CAPTURE_PROMPT,
    rendererUrl: e.ELECTRON_RENDERER_URL
  })
}

/** AppImage'ın gerçek yolu (yalnızca Linux AppImage içinden çalışırken). */
export function appImagePath(): string | undefined {
  const path = process.env.APPIMAGE
  // Başka bir kurulumdan kalmış değer açılış kaydına yanlış dosya yazdırmasın: dosya gerçekten var olmalı.
  return path && existsSync(path) ? path : undefined
}

// --- Sağlayıcı key'leri ve Vertex hedefi --------------------------------------------
// Sıra: süreç ortamı → kullanıcı klasöründeki .env → proje kökündeki .env (yalnızca geliştirmede paketin içinde olur).
// Değerler belgelenen tırnak temizliği dışında değiştirilmez; key biçimi kullanılırken doğrulanır.

export const ENV_NAMES = [...PROVIDERS.map((p) => PROVIDER_INFO[p].env), 'GOOGLE_API_KEY', 'VERTEX_PROJECT_ID', 'VERTEX_LOCATION'] as const
const isEnvName = (k: string) => (ENV_NAMES as readonly string[]).includes(k)

/** Yalnızca ENV_NAMES içindeki adlar bulunur. */
export type EnvMap = Record<string, string>

function parseEnvFile(path: string): EnvMap {
  if (!existsSync(path)) return {}
  const out: EnvMap = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=(.*)$/.exec(line)
    const name = m?.[1]
    const raw = m?.[2]
    if (name === undefined || raw === undefined || !isEnvName(name)) continue
    // Değerin çevresindeki boşluk dosya biçimine aittir; tek ya da çift tırnak varsa içi aynen alınır.
    const value = raw.trim()
    const quoted = /^(['"])(.*)\1$/.exec(value)
    out[name] = quoted?.[2] ?? value
  }
  return out
}

export function envValues(): EnvMap {
  const files = [join(app.getAppPath(), '.env'), join(app.getPath('userData'), '.env')]
  const out: EnvMap = {}
  for (const file of files) Object.assign(out, parseEnvFile(file))
  for (const name of ENV_NAMES) {
    const v = process.env[name]
    if (v) out[name] = v
  }
  return out
}

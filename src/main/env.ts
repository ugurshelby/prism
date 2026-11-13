// The single source of the environment variables Prism reads. No other module looks at process.env directly.
// Development switches (PRISM_*, ELECTRON_RENDERER_URL) are ignored in an installed build: someone who can change the
// environment must not be able to steer the packaged app's behavior.

import { app } from 'electron'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { PROVIDERS, PROVIDER_INFO } from '@shared/catalog'
import { logWarn } from './log'

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

/** Populated only in development; always an empty object in an installed build. */
export function devEnv(): DevEnv {
  if (dev) return dev
  if (app.isPackaged) return (dev = {})
  const parsed = DevSchema.safeParse(process.env)
  if (!parsed.success) throw new Error(`[env] invalid development environment variables: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`)
  const e = parsed.data
  return (dev = {
    userData: e.PRISM_USER_DATA,
    captureDir: e.PRISM_CAPTURE,
    capturePrompt: e.PRISM_CAPTURE_PROMPT,
    rendererUrl: e.ELECTRON_RENDERER_URL
  })
}

/** The AppImage's real path (only when running from inside a Linux AppImage). */
export function appImagePath(): string | undefined {
  if (process.platform !== 'linux' || !app.isPackaged) return undefined
  const path = process.env.APPIMAGE
  // A value left over from another install must not make the login entry point at the wrong file: the file must really exist (the name may have changed).
  return path && existsSync(path) && statSync(path).isFile() ? path : undefined
}

// --- Provider keys and the Vertex target (development only) ----------------------
// An installed build reads keys only from the encrypted vault: environment variables and .env files are plain text.
// In development the order is: process environment → .env in the user folder → .env at the project root.
// Values are not altered except for the documented quote stripping; the key format is validated when used.

/**
 * If an old .env is left in the user folder of an installed build, the key names in it (not the values).
 * So the UI can say "re-save the key from Settings"; the values are never read or used.
 */
let leftover: { stamp: string; names: string[] } | null = null

export function leftoverEnvNames(): string[] {
  if (!app.isPackaged) return []
  const path = join(app.getPath('userData'), '.env')
  // The file is not re-read until it changes: the settings view asks several times per provider.
  let stamp = 'none'
  try {
    if (existsSync(path)) {
      const st = statSync(path)
      stamp = `${st.mtimeMs}:${st.size}`
    }
  } catch (e) {
    logWarn('env', 'could not get .env info', e)
  }
  if (leftover?.stamp === stamp) return leftover.names
  const names = Object.entries(parseEnvFile(path))
    .filter(([k, v]) => v !== '' && !PUBLIC_ENV.includes(k))
    .map(([k]) => k)
  leftover = { stamp, names }
  return names
}

export const ENV_NAMES = [...PROVIDERS.map((p) => PROVIDER_INFO[p].env), 'GOOGLE_API_KEY', 'VERTEX_PROJECT_ID', 'VERTEX_LOCATION'] as const
const isEnvName = (k: string) => (ENV_NAMES as readonly string[]).includes(k)

/** Only names in ENV_NAMES are found. */
export type EnvMap = Record<string, string>

function parseEnvFile(path: string): EnvMap {
  if (!existsSync(path)) return {}
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (e) {
    // An unreadable .env (folder, permission) does not crash the app; it behaves as if there were no key, and the problem is logged.
    logWarn('env', '.env could not be read, ignored', e)
    return {}
  }
  const out: EnvMap = {}
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=(.*)$/.exec(line)
    const name = m?.[1]
    const raw = m?.[2]
    if (name === undefined || raw === undefined || !isEnvName(name)) continue
    // Whitespace around the value belongs to the file format; if there are single or double quotes, the inside is taken as is.
    const value = raw.trim()
    const quoted = /^(['"])(.*)\1$/.exec(value)
    out[name] = quoted?.[2] ?? value
  }
  return out
}

/** The non-secret Vertex target; in an installed build it can also be read from the .env in the user folder. */
const PUBLIC_ENV = ['VERTEX_PROJECT_ID', 'VERTEX_LOCATION']

export function envValues(): EnvMap {
  if (app.isPackaged) {
    const fromUserData = parseEnvFile(join(app.getPath('userData'), '.env'))
    return Object.fromEntries(Object.entries(fromUserData).filter(([k]) => PUBLIC_ENV.includes(k)))
  }
  const files = [join(app.getAppPath(), '.env'), join(app.getPath('userData'), '.env')]
  const out: EnvMap = {}
  for (const file of files) Object.assign(out, parseEnvFile(file))
  for (const name of ENV_NAMES) {
    const v = process.env[name]
    if (v) out[name] = v
  }
  return out
}

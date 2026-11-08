// Eval maliyet sayacı ve kayıt maskesi. Fiyatlar katalogdaki liste fiyatlarıdır (indirimli dönemde gerçeğin üstünde
// kalır, yani tavan güvenli tarafta). Tanınmayan model en pahalı Gemini fiyatıyla sayılır.
import { MODELS, isModelId } from '@shared/catalog'
import type { Usage } from '@shared/types'

const FALLBACK = MODELS['gemini-4-argon'].price

export class BudgetExceeded extends Error {}

export interface MeterEntry {
  role: string
  model: string
  promptTokens: number
  outputTokens: number
  usd: number
}

export class Meter {
  usd = 0
  tokens = 0
  readonly entries: MeterEntry[] = []

  constructor(
    readonly maxUsd: number,
    readonly maxTokens: number
  ) {}

  add(role: string, model: string, usage: Usage) {
    const price = isModelId(model) ? MODELS[model].price : FALLBACK
    // Düşünme token'ları çıktı fiyatıyla faturalanır.
    const out = usage.outputTokens + usage.thoughtsTokens
    const usd = (usage.promptTokens * price.input + out * price.output) / 1e6
    this.usd += usd
    this.tokens += usage.promptTokens + out
    this.entries.push({ role, model, promptTokens: usage.promptTokens, outputTokens: out, usd })
    if (this.usd > this.maxUsd) throw new BudgetExceeded(`Koşu tavanı aşıldı: ${this.usd.toFixed(3)} > ${this.maxUsd} USD`)
    if (this.tokens > this.maxTokens) throw new BudgetExceeded(`Token tavanı aşıldı: ${this.tokens} > ${this.maxTokens}`)
  }

  /** Yeni çağrıdan önce: tavan zaten dolduysa başlatma. */
  check() {
    if (this.usd > this.maxUsd || this.tokens > this.maxTokens) throw new BudgetExceeded('Koşu tavanı dolu')
  }
}

// Kaydedilen her metinde bilinen key kalıpları maskelenir (çıktıda key olmamalı; bu ek güvencedir).
const KEY_PATTERNS = [/sk-ant-[A-Za-z0-9_-]{8,}/g, /sk-[A-Za-z0-9_-]{16,}/g, /AIza[0-9A-Za-z_-]{20,}/g, /xai-[A-Za-z0-9_-]{16,}/g, /AQ\.[A-Za-z0-9_-]{20,}/g]

export function mask(text: string, secrets: string[]): string {
  let out = text
  for (const s of secrets) if (s.length >= 8) out = out.split(s).join('[KEY]')
  for (const re of KEY_PATTERNS) out = out.replace(re, '[KEY]')
  return out
}

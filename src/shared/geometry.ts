// Pencere yerleşiminin saf hesapları (window.ts kullanır, testler doğrular). Ekran bilgisi dışarıdan verilir.
import type { PanelAnchor } from './types'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Dikdörtgen çalışma alanı içinde kalsın (görev çubuğu ve dock dışı); büyükse alana sığacak kadar küçülür. */
export function clampToArea(b: Rect, area: Rect): Rect {
  const width = Math.min(b.width, area.width)
  const height = Math.min(b.height, area.height)
  return {
    width,
    height,
    x: Math.round(Math.min(Math.max(b.x, area.x), area.x + area.width - width)),
    y: Math.round(Math.min(Math.max(b.y, area.y), area.y + area.height - height))
  }
}

/**
 * Panel, kürenin köşesine yaslanır: küre ekranın sağ yarısındaysa panel sola, alt yarısındaysa yukarı açılır.
 * Böylece panel ekrana sığar ve kapanınca küre aynı köşeye döner.
 */
export function panelFromPill(pill: Rect, size: { width: number; height: number }, area: Rect): { bounds: Rect; anchor: PanelAnchor } {
  const width = Math.min(size.width, area.width)
  const height = Math.min(size.height, area.height)
  const anchor: PanelAnchor = {
    h: pill.x + pill.width / 2 > area.x + area.width / 2 ? 'right' : 'left',
    v: pill.y + pill.height / 2 > area.y + area.height / 2 ? 'bottom' : 'top'
  }
  const x = anchor.h === 'right' ? pill.x + pill.width - width : pill.x
  const y = anchor.v === 'bottom' ? pill.y + pill.height - height : pill.y
  return { bounds: clampToArea({ x, y, width, height }, area), anchor }
}

/** Küre, panelin yaslandığı köşeye konur. */
export function pillFromPanel(panel: Rect, anchor: PanelAnchor, size: number, area: Rect): Rect {
  const x = anchor.h === 'right' ? panel.x + panel.width - size : panel.x
  const y = anchor.v === 'bottom' ? panel.y + panel.height - size : panel.y
  return clampToArea({ x, y, width: size, height: size }, area)
}

/** Bırakılan küre kenara `snap` pikselden yakınsa, kenardan `margin` içeride durur. */
export function snapToEdges(p: Rect, area: Rect, snap: number, margin: number): { x: number; y: number } {
  let { x, y } = clampToArea(p, area)
  if (x - area.x < snap) x = area.x + margin
  if (area.x + area.width - (x + p.width) < snap) x = area.x + area.width - p.width - margin
  if (y - area.y < snap) y = area.y + margin
  if (area.y + area.height - (y + p.height) < snap) y = area.y + area.height - p.height - margin
  return { x, y }
}

/** Kritik sönümlü yay: 0'dan 1'e aşmadan yaklaşır; t 0..1 arasında normalize süre. */
export const springProgress = (t: number) => (t >= 1 ? 1 : 1 - (1 + 6 * t) * Math.exp(-6 * t))

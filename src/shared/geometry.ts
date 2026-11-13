// Pure calculations for window placement (used by window.ts, verified by tests). Screen info is passed in.
import type { PanelAnchor } from './types'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Stay inside the rectangular work area (outside taskbar and dock); if larger, shrinks to fit the area. */
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
  * The panel is anchored to the orb's corner: if the orb is in the right half of the screen the panel opens left, if in the bottom half it opens upward.
  * That way the panel fits on screen and the orb returns to the same corner when it closes.
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

/** The orb is placed at the corner the panel is anchored to. */
export function pillFromPanel(panel: Rect, anchor: PanelAnchor, size: number, area: Rect): Rect {
  const x = anchor.h === 'right' ? panel.x + panel.width - size : panel.x
  const y = anchor.v === 'bottom' ? panel.y + panel.height - size : panel.y
  return clampToArea({ x, y, width: size, height: size }, area)
}

/** If a dropped orb is closer than `snap` pixels to an edge, it rests `margin` inside the edge. */
export function snapToEdges(p: Rect, area: Rect, snap: number, margin: number): { x: number; y: number } {
  let { x, y } = clampToArea(p, area)
  if (x - area.x < snap) x = area.x + margin
  if (area.x + area.width - (x + p.width) < snap) x = area.x + area.width - p.width - margin
  if (y - area.y < snap) y = area.y + margin
  if (area.y + area.height - (y + p.height) < snap) y = area.y + area.height - p.height - margin
  return { x, y }
}

/** Critically damped spring: approaches from 0 to 1 without overshoot; t is normalized time in 0..1. */
export const springProgress = (t: number) => (t >= 1 ? 1 : 1 - (1 + 6 * t) * Math.exp(-6 * t))

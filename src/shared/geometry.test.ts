import { describe, expect, it } from 'vitest'
import { clampToArea, panelFromPill, pillFromPanel, snapToEdges, springProgress } from './geometry'

// 1920x1080 screen, 40 px taskbar at the bottom.
const area = { x: 0, y: 0, width: 1920, height: 1040 }
const size = { width: 440, height: 640 }

describe('panelFromPill', () => {
  it('opens left and down from a pill at the top right', () => {
    const { bounds, anchor } = panelFromPill({ x: 1820, y: 20, width: 84, height: 84 }, size, area)
    expect(anchor).toEqual({ h: 'right', v: 'top' })
    expect(bounds.x + bounds.width).toBe(1904)
    expect(bounds.y).toBe(20)
  })

  it('opens up from a pill near the bottom and never enters the taskbar', () => {
    const { bounds, anchor } = panelFromPill({ x: 20, y: 950, width: 84, height: 84 }, size, area)
    expect(anchor).toEqual({ h: 'left', v: 'bottom' })
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(1040)
    expect(bounds.x).toBe(20)
  })

  it('shrinks to a small screen', () => {
    const small = { x: 0, y: 0, width: 400, height: 500 }
    const { bounds } = panelFromPill({ x: 10, y: 10, width: 84, height: 84 }, size, small)
    expect(bounds).toEqual({ x: 0, y: 0, width: 400, height: 500 })
  })

  it('returns the pill to the corner it opened from', () => {
    const pill = { x: 1820, y: 900, width: 84, height: 84 }
    const { bounds, anchor } = panelFromPill(pill, size, area)
    expect(pillFromPanel(bounds, anchor, 84, area)).toEqual(pill)
  })

  it('works on a second display to the left (negative coordinates)', () => {
    const left = { x: -1280, y: 0, width: 1280, height: 984 }
    const { bounds } = panelFromPill({ x: -100, y: 10, width: 84, height: 84 }, size, left)
    expect(bounds.x).toBeGreaterThanOrEqual(-1280)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(0)
  })
})

describe('snapToEdges', () => {
  it('snaps near edges and keeps the margin', () => {
    expect(snapToEdges({ x: 10, y: 500, width: 84, height: 84 }, area, 24, 8)).toEqual({ x: 8, y: 500 })
    expect(snapToEdges({ x: 1830, y: 940, width: 84, height: 84 }, area, 24, 8)).toEqual({ x: 1828, y: 948 })
  })

  it('pulls a pill dropped on the taskbar back into the work area', () => {
    const p = snapToEdges({ x: 900, y: 1060, width: 84, height: 84 }, area, 24, 8)
    expect(p.y + 84).toBeLessThanOrEqual(1040)
  })

  it('leaves a pill in the middle alone', () => {
    expect(snapToEdges({ x: 900, y: 500, width: 84, height: 84 }, area, 24, 8)).toEqual({ x: 900, y: 500 })
  })
})

describe('clampToArea and spring', () => {
  it('moves a window from a removed display back on screen', () => {
    expect(clampToArea({ x: 3000, y: 200, width: 440, height: 640 }, area)).toEqual({ x: 1480, y: 200, width: 440, height: 640 })
  })

  it('spring rises monotonically to exactly 1 without overshoot', () => {
    const v = [0, 0.1, 0.3, 0.6, 0.9, 1].map(springProgress)
    expect(v[0]).toBe(0)
    expect(v.at(-1)).toBe(1)
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1] ?? 0)
    expect(Math.max(...v)).toBeLessThanOrEqual(1)
  })
})

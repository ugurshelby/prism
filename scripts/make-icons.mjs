// Generates per-product app and tray icons without dependencies: `npm run icons` (all) or `npm run icons -- ray`.
// Output goes to resources/<product>/; the root resources/icon.png and tray*.png are untouched (the current build reads them).
// Interim artwork: Spectrum splits the beam into a rainbow, Ray passes a single beam through unrefracted. Final logos are the owner's choice.
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

// ---- PNG encoder ----
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function png(size, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

// ---- Geometry ----
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}
const TRI = [[0.5, 0.25], [0.73, 0.7], [0.27, 0.7]]
function inTri(x, y) {
  const s = (a, b) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])
  const d1 = s(TRI[0], TRI[1]), d2 = s(TRI[1], TRI[2]), d3 = s(TRI[2], TRI[0])
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}
const triEdge = (x, y) => Math.min(...TRI.map((a, i) => segDist(x, y, ...a, ...TRI[(i + 1) % 3])))
const RING = ['#f78fb3', '#ff9a5a', '#ffd36e', '#6cc9ff', '#8be28f', '#f78fb3'].map(hex)

/** Composites layers on top of each other: [r,g,b,a] (0-255, a 0-1). */
function over(layers) {
  let out = [0, 0, 0, 0]
  for (const [lr, lg, lb, la] of layers) {
    const a = la + out[3] * (1 - la)
    out = [0, 1, 2].map((i) => (([lr, lg, lb][i] * la + out[i] * out[3] * (1 - la)) / (a || 1))).concat(a)
  }
  return out
}

// ---- Product artwork: (x, y, kind) -> [r,g,b,a]; kind 'app' | 'tray' | 'template' ----

/** Spectrum: dark sphere, rainbow ring, prism that splits the beam into two colors (accent --warm #ff8a4c). */
function drawSpectrum(x, y, kind) {
  const layers = []
  const cx = x - 0.5, cy = y - 0.5, r = Math.hypot(cx, cy)
  if (kind === 'app') {
    if (r < 0.47) layers.push([...mix(hex('#1d2029'), hex('#0b0c10'), y), 1])
    if (r > 0.425 && r < 0.47) {
      const t = ((Math.atan2(cy, cx) / (2 * Math.PI) + 1.25) % 1) * (RING.length - 1)
      layers.push([...mix(RING[Math.floor(t)], RING[Math.ceil(t)], t % 1), 1])
    }
  }
  const w = kind === 'app' ? 0.028 : 0.075
  if (kind !== 'template' && inTri(x, y)) layers.push([255, 138, 76, 0.16])
  // incoming beam and two outgoing beams
  const beams = [
    [[0.06, 0.58, 0.4, 0.5], kind === 'template' ? '#000000' : '#ffffff'],
    [[0.6, 0.5, 0.95, 0.38], '#6cc9ff'],
    [[0.6, 0.51, 0.95, 0.56], '#ff9a5a']
  ]
  if (kind === 'app') for (const [s, c] of beams) if (segDist(x, y, ...s) < 0.018) layers.push([...hex(c), 0.95])
  if (triEdge(x, y) < w) layers.push(kind === 'template' ? [0, 0, 0, 1] : [...mix(hex('#ffd36e'), hex('#ff8a4c'), y), 1])
  return over(layers)
}

/** Ray: same sphere and prism, single color (accent --beam #eef0f4); the beam passes straight through the prism unrefracted. */
const BEAM = hex('#eef0f4')
function drawRay(x, y, kind) {
  const layers = []
  const r = Math.hypot(x - 0.5, y - 0.5)
  const ink = kind === 'template' ? [0, 0, 0] : BEAM
  if (kind === 'app') {
    if (r < 0.47) layers.push([...mix(hex('#1d2029'), hex('#0b0c10'), y), 1])
    if (r > 0.425 && r < 0.47) layers.push([...BEAM, 1])
    if (inTri(x, y)) layers.push([...BEAM, 0.1])
  }
  // single straight beam: thick at tray size, the mark that tells it apart from Spectrum at 16 px
  const bw = kind === 'app' ? 0.018 : 0.06
  if (segDist(x, y, 0.06, 0.55, 0.94, 0.55) < bw) layers.push([...ink, kind === 'app' ? 0.95 : 1])
  if (triEdge(x, y) < (kind === 'app' ? 0.028 : 0.075)) layers.push([...ink, 1])
  return over(layers)
}

// Add new products here. If a product's artwork is later replaced by a rasterized SVG, only
// `draw` changes: the (x, y, kind) signature stays, as do the PNG encoder and size list.
const PRODUCTS = { ray: { draw: drawRay }, spectrum: { draw: drawSpectrum } }

function render(size, kind, draw) {
  const buf = Buffer.alloc(size * size * 4)
  const SS = 4
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size; px++) {
      let acc = [0, 0, 0, 0]
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = draw((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, kind)
          acc = [acc[0] + c[0] * c[3], acc[1] + c[1] * c[3], acc[2] + c[2] * c[3], acc[3] + c[3]]
        }
      const a = acc[3] / (SS * SS)
      const i = (py * size + px) * 4
      buf[i] = acc[3] ? acc[0] / acc[3] : 0
      buf[i + 1] = acc[3] ? acc[1] / acc[3] : 0
      buf[i + 2] = acc[3] ? acc[2] / acc[3] : 0
      buf[i + 3] = Math.round(a * 255)
    }
  return png(size, buf)
}

const SIZES = [
  ['icon.png', 1024, 'app'],
  ['tray.png', 16, 'tray'],
  ['tray@2x.png', 32, 'tray'],
  ['trayTemplate.png', 16, 'template'],
  ['trayTemplate@2x.png', 32, 'template']
]

const arg = process.argv[2]
if (arg !== undefined && !Object.hasOwn(PRODUCTS, arg)) {
  console.error(`usage: node scripts/make-icons.mjs [${Object.keys(PRODUCTS).join('|')}]`)
  process.exit(2)
}
for (const name of arg === undefined ? Object.keys(PRODUCTS) : [arg]) {
  const out = new URL(`../resources/${name}/`, import.meta.url)
  mkdirSync(out, { recursive: true })
  for (const [file, size, kind] of SIZES) writeFileSync(new URL(file, out), render(size, kind, PRODUCTS[name].draw))
  console.log(`${name}: ${SIZES.map(([f]) => f).join(', ')}`)
}

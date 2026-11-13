// The product -> release -> system picker on the download page. The data is embedded in the page as JSON at build time;
// the DOM is built with textContent only; the data is shape-checked before use and links go through safeUrl.
import { detectOs } from './os'
import { safeUrl } from './url'

type Os = 'win' | 'mac' | 'linux'
interface FileRow {
  label: string
  name: string
  url: string
  size: string
  sha: string | null
}
interface Version {
  version: string
  date: string
  url: string
  sums: string | null
  changes: string[]
  files: Record<Os, FileRow[]>
}
interface Product {
  id: string
  name: string
  status: string
  tagline: string
  versions: Version[]
}
interface Data {
  products: Product[]
  initial: string
  text: Record<string, string>
  steps: Record<Os, string>
}

// The embedded JSON is produced at build time, but data read from the DOM is still untrusted: if the shape is wrong the picker is not built.
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isStrOrNull = (v: unknown) => v === null || isStr(v)
const isStrMap = (v: unknown, required: readonly string[] = []) =>
  isObj(v) && Object.values(v).every(isStr) && required.every((k) => k in v)
const OSES = ['win', 'mac', 'linux'] as const
const isOs = (v: unknown): v is Os => OSES.some((o) => o === v)
// Texts the picker uses; if one is missing the picker is not built and the fallback links on the page stay.
const TEXT_KEYS = [
  'changes',
  'changesOnGitHub',
  'checksum',
  'comingSoon',
  'comingSoonBody',
  'firstLaunch',
  'latest',
  'noFiles',
  'noReleases',
  'notReleased',
  'notReleasedBody',
  'released',
  'sums'
] as const

const isFile = (v: unknown): v is FileRow =>
  isObj(v) && isStr(v.label) && isStr(v.name) && isStr(v.url) && isStr(v.size) && isStrOrNull(v.sha)
const isFiles = (v: unknown) =>
  isObj(v) &&
  OSES.every((o) => {
    const rows = v[o]
    return Array.isArray(rows) && rows.every(isFile)
  })
const isVersion = (v: unknown): v is Version =>
  isObj(v) &&
  isStr(v.version) &&
  isStr(v.date) &&
  isStr(v.url) &&
  isStrOrNull(v.sums) &&
  Array.isArray(v.changes) &&
  v.changes.every(isStr) &&
  isFiles(v.files)
const isProduct = (v: unknown): v is Product =>
  isObj(v) && isStr(v.id) && isStr(v.name) && isStr(v.status) && isStr(v.tagline) && Array.isArray(v.versions) && v.versions.every(isVersion)
const isData = (v: unknown): v is Data =>
  isObj(v) &&
  Array.isArray(v.products) &&
  v.products.length > 0 &&
  v.products.every(isProduct) &&
  isStr(v.initial) &&
  isStrMap(v.text, TEXT_KEYS) &&
  isStrMap(v.steps, OSES)

function readData(json: HTMLElement): Data | null {
  try {
    const raw: unknown = JSON.parse(json.textContent || 'null')
    if (isData(raw)) return raw
    console.warn('Download data is not in the expected shape')
    return null
  } catch (e) {
    // Corrupt embedded data: the picker is not built and the script-free links on the page stay.
    console.warn('Download data could not be read', e)
    return null
  }
}

const root = document.querySelector<HTMLElement>('[data-picker]')
const json = document.getElementById('dl-data')
const data = json ? readData(json) : null
if (root && data) init(root, data)

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

function init(root: HTMLElement, data: Data) {
  const tabs = root.querySelector<HTMLElement>('[data-products]')!
  const osTabs = root.querySelector<HTMLElement>('[data-os]')!
  const select = root.querySelector<HTMLSelectElement>('[data-version]')!
  const body = root.querySelector<HTMLElement>('[data-body]')!
  const controls = root.querySelector<HTMLElement>('[data-controls]')!

  const params = new URLSearchParams(location.search)
  const fromHash = location.hash.slice(1)
  let product = data.products.find((e) => e.id === fromHash) ?? data.products.find((e) => e.id === data.initial) ?? data.products[0]!
  let version = product.versions[0]
  const fromQuery = params.get('os')
  let os: Os = isOs(fromQuery) ? fromQuery : 'win'
  let detected: Os | null = null
  let macArch: 'arm' | 'intel' = 'arm'

  root.classList.add('is-ready')

  const moveIndicator = (group: HTMLElement) => {
    const active = group.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!active) return
    group.style.setProperty('--x', `${active.offsetLeft}px`)
    group.style.setProperty('--y', `${active.offsetTop}px`)
    group.style.setProperty('--w', `${active.offsetWidth}px`)
    group.style.setProperty('--h', `${active.offsetHeight}px`)
  }

  const renderTabs = () => {
    for (const b of tabs.querySelectorAll<HTMLButtonElement>('[data-product]')) {
      b.setAttribute('aria-selected', String(b.dataset.product === product.id))
    }
    for (const b of osTabs.querySelectorAll<HTMLButtonElement>('[data-os-tab]')) {
      b.setAttribute('aria-selected', String(b.dataset.osTab === os))
      b.querySelector('.os-detected')?.toggleAttribute('hidden', b.dataset.osTab !== detected)
    }
    moveIndicator(tabs)
    moveIndicator(osTabs)
  }

  const renderVersions = () => {
    select.replaceChildren(
      ...product.versions.map((v, i) => {
        const o = el('option', undefined, `${product.name} ${v.version}${i === 0 ? ` · ${data.text.latest}` : ''}`)
        o.value = v.version
        o.selected = v === version
        return o
      })
    )
    controls.toggleAttribute('data-empty', product.versions.length === 0)
    select.disabled = product.versions.length < 2
  }

  const renderBody = () => {
    const nodes: Node[] = []
    if (!version) {
      const box = el('div', 'empty')
      box.append(
        el('b', undefined, product.status === 'planned' ? data.text.notReleased : product.status === 'soon' ? data.text.comingSoon : data.text.noReleases),
        el('p', undefined, product.status === 'planned' ? data.text.notReleasedBody : product.status === 'soon' ? data.text.comingSoonBody : '')
      )
      nodes.push(box)
    } else {
      const rows = version.files[os]
      const list = el('div', 'dl-files')
      if (!rows.length) list.append(el('p', 'muted', data.text.noFiles))
      rows.forEach((f, i) => {
        const a = el('a', 'dl-file')
        const href = safeUrl(f.url)
        if (href) a.href = href
        a.style.setProperty('--i', String(i))
        const head = el('b')
        head.append(el('span', undefined, f.label), el('span', 'muted', f.size))
        a.append(head, el('span', 'mono', f.name))
        if (f.sha) {
          const sha = el('span', 'mono', `${data.text.checksum} ${f.sha.slice(0, 16)}…`)
          sha.title = f.sha
          a.append(sha)
        }
        if (os === 'mac' && ((macArch === 'arm' && i === 0) || (macArch === 'intel' && i === 1)) && detected === 'mac') a.classList.add('is-detected')
        list.append(a)
      })
      const first = el('div', 'first-launch')
      first.append(el('b', undefined, data.text.firstLaunch), el('p', undefined, data.steps[os]))

      const notes = el('div', 'notes')
      notes.append(el('h3', undefined, data.text.changes.replace('{v}', `${product.name} ${version.version}`)))
      notes.append(el('p', 'muted', `${data.text.released}: ${version.date}`))
      if (version.changes.length) {
        const ul = el('ul')
        version.changes.forEach((c) => ul.append(el('li', undefined, c)))
        notes.append(ul)
      }
      const links = el('p', 'links')
      const relHref = safeUrl(version.url)
      if (relHref) {
        const rel = el('a', 'text-link', data.text.changesOnGitHub)
        rel.href = relHref
        links.append(rel)
      }
      const sumsHref = safeUrl(version.sums)
      if (sumsHref) {
        const s = el('a', 'text-link', data.text.sums)
        s.href = sumsHref
        links.append(s)
      }
      notes.append(links)

      const left = el('div', 'dl-main')
      left.append(list, first)
      const grid = el('div', 'dl-layout')
      grid.append(left, notes)
      nodes.push(grid)
    }
    body.classList.remove('swap')
    body.replaceChildren(...nodes)
    void body.offsetWidth
    body.classList.add('swap')
  }

  const render = () => {
    renderTabs()
    renderVersions()
    renderBody()
  }

  tabs.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-product]')
    if (!b || b.dataset.product === product.id) return
    product = data.products.find((x) => x.id === b.dataset.product)!
    version = product.versions[0]
    history.replaceState(null, '', `#${product.id}`)
    render()
  })
  osTabs.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-os-tab]')
    if (!b || !isOs(b.dataset.osTab)) return
    os = b.dataset.osTab
    renderTabs()
    renderBody()
  })
  select.addEventListener('change', () => {
    version = product.versions.find((v) => v.version === select.value)!
    renderBody()
  })
  // Arrow-key navigation between tabs.
  for (const group of [tabs, osTabs]) {
    group.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      const items = [...group.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
      const i = items.indexOf(document.activeElement as HTMLButtonElement)
      const next = items[(i + (e.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length]
      next.focus()
      next.click()
    })
  }
  addEventListener('resize', () => renderTabs())

  render()
  detectOs().then((d) => {
    if (!d) return
    detected = d.os
    macArch = d.macArch ?? 'arm'
    if (!params.get('os')) os = d.os
    renderTabs()
    renderBody()
  })
}

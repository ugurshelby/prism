// İndirme sayfasındaki sürüm → yayın → sistem seçicisi. Veri, sayfaya derleme sırasında JSON olarak gömülür;
// DOM yalnızca textContent ile kurulur.
import { detectOs } from './os'

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
interface Edition {
  id: string
  name: string
  status: string
  tagline: string
  versions: Version[]
}
interface Data {
  editions: Edition[]
  initial: string
  text: Record<string, string>
  steps: Record<Os, string>
}

const root = document.querySelector<HTMLElement>('[data-picker]')
const json = document.getElementById('dl-data')
if (root && json) init(root, JSON.parse(json.textContent || '{}') as Data)

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

function init(root: HTMLElement, data: Data) {
  const tabs = root.querySelector<HTMLElement>('[data-editions]')!
  const osTabs = root.querySelector<HTMLElement>('[data-os]')!
  const select = root.querySelector<HTMLSelectElement>('[data-version]')!
  const body = root.querySelector<HTMLElement>('[data-body]')!
  const controls = root.querySelector<HTMLElement>('[data-controls]')!

  const params = new URLSearchParams(location.search)
  const fromHash = location.hash.slice(1)
  let edition = data.editions.find((e) => e.id === fromHash) ?? data.editions.find((e) => e.id === data.initial)!
  let version = edition.versions[0]
  let os: Os = (['win', 'mac', 'linux'] as Os[]).find((o) => o === params.get('os')) ?? 'win'
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
    for (const b of tabs.querySelectorAll<HTMLButtonElement>('[data-edition]')) {
      b.setAttribute('aria-selected', String(b.dataset.edition === edition.id))
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
      ...edition.versions.map((v, i) => {
        const o = el('option', undefined, `${edition.name} ${v.version}${i === 0 ? ` · ${data.text.latest}` : ''}`)
        o.value = v.version
        o.selected = v === version
        return o
      })
    )
    controls.toggleAttribute('data-empty', edition.versions.length === 0)
    select.disabled = edition.versions.length < 2
  }

  const renderBody = () => {
    const nodes: Node[] = []
    if (!version) {
      const box = el('div', 'empty')
      box.append(
        el('b', undefined, edition.status === 'planned' ? data.text.notReleased : data.text.noReleases),
        el('p', undefined, edition.status === 'planned' ? data.text.notReleasedBody : '')
      )
      nodes.push(box)
    } else {
      const rows = version.files[os]
      const list = el('div', 'dl-files')
      if (!rows.length) list.append(el('p', 'muted', data.text.noFiles))
      rows.forEach((f, i) => {
        const a = el('a', 'dl-file')
        a.href = f.url
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
      notes.append(el('h3', undefined, data.text.changes.replace('{v}', `${edition.name} ${version.version}`)))
      notes.append(el('p', 'muted', `${data.text.released}: ${version.date}`))
      if (version.changes.length) {
        const ul = el('ul')
        version.changes.forEach((c) => ul.append(el('li', undefined, c)))
        notes.append(ul)
      }
      const links = el('p', 'links')
      const rel = el('a', 'text-link', data.text.changesOnGitHub)
      rel.href = version.url
      links.append(rel)
      if (version.sums) {
        const s = el('a', 'text-link', data.text.sums)
        s.href = version.sums
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
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-edition]')
    if (!b || b.dataset.edition === edition.id) return
    edition = data.editions.find((x) => x.id === b.dataset.edition)!
    version = edition.versions[0]
    history.replaceState(null, '', `#${edition.id}`)
    render()
  })
  osTabs.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-os-tab]')
    if (!b) return
    os = b.dataset.osTab as Os
    renderTabs()
    renderBody()
  })
  select.addEventListener('change', () => {
    version = edition.versions.find((v) => v.version === select.value)!
    renderBody()
  })
  // Sekmelerde ok tuşlarıyla gezinme.
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

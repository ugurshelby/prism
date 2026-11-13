// Adjusts the home page download button to the visitor's system.
// If the script does not run, the button goes to the download page; nothing is lost.
import { detectOs } from './os'
import { safeUrl } from './url'

detectOs().then((d) => {
  if (!d) return
  const key = d.os === 'mac' ? (d.macArch === 'intel' ? 'macIntel' : 'macArm') : d.os
  for (const el of document.querySelectorAll<HTMLAnchorElement>('[data-dl]')) {
    const url = safeUrl(el.dataset[key])
    const label = el.dataset[`label${key[0].toUpperCase()}${key.slice(1)}`]
    if (!url || !label) continue
    el.href = url
    const span = el.querySelector('[data-label]')
    if (span) span.textContent = label
  }
})

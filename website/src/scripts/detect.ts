// Ziyaretçinin işletim sistemine göre indirme düğmesini ve indirme sayfasındaki kartı seçer.
// Betik çalışmazsa düğme indirme sayfasına gider; hiçbir şey kaybolmaz.
type Os = 'win' | 'macArm' | 'macIntel' | 'linux'

async function detect(): Promise<Os | null> {
  const ua = navigator.userAgent
  const data = (navigator as any).userAgentData
  const platform: string = data?.platform || navigator.platform || ''
  if (/Android|iPhone|iPad|iPod/i.test(ua) || data?.mobile) return null
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return 'win'
  if (/Mac/i.test(platform) || /Mac OS X/i.test(ua)) {
    // Safari mimariyi söylemez; 2020'den beri satılan Mac'lerin çoğu Apple Silicon.
    try {
      const { architecture } = (await data?.getHighEntropyValues?.(['architecture'])) ?? {}
      if (architecture === 'x86') return 'macIntel'
    } catch {}
    return 'macArm'
  }
  if (/Linux|X11|CrOS/i.test(platform + ua)) return 'linux'
  return null
}

detect().then((os) => {
  if (!os) return
  for (const el of document.querySelectorAll<HTMLAnchorElement>('[data-dl]')) {
    const url = el.dataset[os]
    const label = el.dataset[`label${os[0].toUpperCase()}${os.slice(1)}`]
    if (!url || !label) continue
    el.href = url
    const span = el.querySelector('[data-label]')
    if (span) span.textContent = label
  }
  const card = document.querySelector(`[data-os-card="${os === 'linux' ? 'linux' : os.startsWith('mac') ? 'mac' : 'win'}"]`)
  card?.classList.add('is-detected')
  document.querySelector(`[data-file="${os}"]`)?.classList.add('is-detected')
})

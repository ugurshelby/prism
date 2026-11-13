// Guesses the visitor's operating system from the browser. Returns null on phones and tablets.
export type DetectedOs = { os: 'win' | 'mac' | 'linux'; macArch?: 'arm' | 'intel' }

export async function detectOs(): Promise<DetectedOs | null> {
  const ua = navigator.userAgent
  const data = (navigator as any).userAgentData
  const platform: string = data?.platform || navigator.platform || ''
  if (/Android|iPhone|iPad|iPod/i.test(ua) || data?.mobile) return null
  if (/Win/i.test(platform) || /Windows/i.test(ua)) return { os: 'win' }
  if (/Mac/i.test(platform) || /Mac OS X/i.test(ua)) {
    // Safari does not report the architecture; most Macs sold since 2020 are Apple Silicon.
    try {
      const { architecture } = (await data?.getHighEntropyValues?.(['architecture'])) ?? {}
      if (architecture === 'x86') return { os: 'mac', macArch: 'intel' }
    } catch {}
    return { os: 'mac', macArch: 'arm' }
  }
  if (/Linux|X11|CrOS/i.test(platform + ua)) return { os: 'linux' }
  return null
}

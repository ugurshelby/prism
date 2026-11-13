import type { ProductId, ProductStatus, Os, Platform } from './site'

export const s = {
  meta: {
    title: 'Prism: prompts written for the model you actually use',
    description:
      'Prism is a free desktop app that turns a rough request into a prompt written for Claude, GPT, Gemini or Grok. It suggests the model and effort level, asks what’s missing, and runs on your own API key.'
  },
  nav: { products: 'Products', download: 'Download', how: 'How it works', docs: 'Docs', github: 'GitHub' },
  cta: {
    download: 'Download',
    downloadFor: (os: string) => `Download for ${os}`,
    otherPlatforms: 'Other systems',
    github: 'Read the code',
    free: 'Free and open source. MIT license, no account, no telemetry.',
    mobile: 'Prism is a desktop app for Windows, macOS and Linux.'
  },
  os: { win: 'Windows', mac: 'macOS', linux: 'Linux' } satisfies Record<Os, string>,
  platform: {
    win: 'Windows installer (x64)',
    macArm: 'Apple Silicon (M1 and later)',
    macIntel: 'Intel Mac',
    appimage: 'AppImage (any distro)',
    deb: '.deb (Debian, Ubuntu)'
  } satisfies Record<Platform, string>,
  hero: {
    eyebrow: 'Prism · Windows, macOS, Linux',
    title: ['Type what you want.', 'Prism writes the prompt.'],
    lead: 'Describe the task the way you’d say it out loud. Prism picks a model and an effort level, asks a question or two if something’s unclear, and hands back a prompt written for Claude, GPT, Gemini or Grok. It runs on your own API key, on your own machine.'
  },
  steps: {
    title: 'Three steps, about a minute',
    items: [
      {
        title: 'Write it rough',
        body: 'Half a sentence is fine, and so is Turkish. Pick a model family, or let Prism look across every one you use.'
      },
      {
        title: 'Check the pick',
        body: 'You see the model, the effort level and the reason. If the task is vague, Prism asks before it writes.'
      },
      {
        title: 'Copy it',
        body: 'The prompt is shaped for where it’s going: a coding agent, a chat window or an API call. The settings to use come with it.'
      }
    ]
  },
  families: {
    title: 'Claude, GPT, Gemini and Grok',
    lead: 'Each family gets its own rules. The prompt you’d give Claude Opus isn’t the one GPT or Gemini wants.'
  },
  features: {
    title: 'What else it does',
    items: [
      {
        icon: 'target',
        title: 'Model and effort, picked for the task',
        body: 'Claude’s effort, GPT and Grok’s reasoning effort, Gemini’s thinking level. Prism only offers levels the model actually has.'
      },
      {
        icon: 'surface',
        title: 'Written for where it lands',
        body: 'Claude Code, Codex, Antigravity and Grok Build get a different prompt than a chat window or an API call.'
      },
      {
        icon: 'key',
        title: 'Keys checked on the spot',
        body: 'Paste a key from Google AI Studio, Vertex AI, Anthropic, OpenAI or xAI. Prism tries it and lists the models it can reach.'
      },
      {
        icon: 'cross',
        title: 'Only models you can use',
        body: 'Cross mode compares families, and it never suggests a model you don’t have.'
      },
      {
        icon: 'tray',
        title: 'One shortcut away',
        body: 'A shortcut opens it (Ctrl+Alt+Space in Ray, Ctrl+Shift+Space in Spectrum). It stays on top, shrinks to a small orb and waits in the tray.'
      },
      {
        icon: 'history',
        title: 'A history you can search',
        body: 'Your last 200 prompts stay on this computer, tagged with model and engine.'
      }
    ]
  },
  privacy: {
    title: 'Your keys stay on your computer',
    body: 'Keys and history are encrypted by your operating system. Prompts go straight to the provider you picked, and what that provider keeps is up to its terms. We don’t run a server, so there’s nothing on our side to log.',
    link: 'Security policy'
  },
  products: {
    title: 'Four products',
    lead: 'Prism is a small family of desktop apps that share one engine. Pick the one that fits how you work. Each is named after something light does inside a prism.',
    status: { available: 'Available', soon: 'Coming soon', planned: 'Planned' } satisfies Record<ProductStatus, string>,
    items: {
      ray: {
        tagline: 'One beam',
        body: 'One model family, kept simple. Choose Claude, GPT, Gemini or Grok once and Prism writes every prompt for it.',
        who: 'For people who stick to one family and want the least setup.'
      },
      spectrum: {
        tagline: 'The beam, split',
        body: 'Several families, one prompt. Choose the families you use; Prism recommends the best model among them and writes a single prompt for it.',
        who: 'For people who use more than one family and want Prism to pick between them.'
      },
      lens: {
        tagline: 'One request, many sessions',
        body: 'Splits a big task across models and parallel sessions, only when splitting pays off, and tells each session what the others are doing.',
        who: 'For developers who run several models or coding sessions at once.'
      },
      iris: {
        tagline: 'Past text',
        body: 'Prompts for image, video, audio and 3D models, plus the best way to get the result you want out of each.',
        who: 'For people who make images, video, music or 3D with generative models.'
      }
    } satisfies Record<ProductId, { tagline: string; body: string; who: string }>,
    features: {
      ray: ['One target family: Claude, GPT, Gemini or Grok', 'Model and effort recommendation within that family', 'Bring your own engine key', 'Change the family any time in settings'],
      spectrum: [
        'Choose the families you use',
        'Recommends one model across them, one prompt out',
        'Engines: Vertex AI, AI Studio, Anthropic, OpenAI, xAI',
        'Keys checked when you add them',
        'Coding agent, chat and API prompts'
      ],
      lens: ['Splits a task only when it pays off', 'Every session’s prompt names what the others do and which files to leave alone', 'Planned'],
      iris: ['Image, video, audio and 3D models', 'Tells you how to get the best result: reference images, aspect ratio, duration, seed', 'Planned']
    } satisfies Record<ProductId, string[]>,
    get: (name: string) => `Get ${name}`,
    notYet: 'Not released yet',
    versions: (n: number) => (n === 1 ? '1 version' : `${n} versions`),
    noBuilds: 'No builds published yet',
    openPage: (name: string) => `About ${name}`,
    page: {
      who: 'Who it’s for',
      shared: 'Every product shares the same engine, the same encrypted key storage and the same knowledge cards. Your keys stay on your computer and prompts go straight to the provider you picked.',
      plannedNote: 'Planned. There is no download yet; the work happens in the open on GitHub.',
      soonNote: 'The first installer is being prepared. Check back soon, or watch the repository on GitHub.',
      all: 'All products',
      downloadPage: 'Go to downloads',
      moved: 'This page is now called Products.'
    }
  },
  download: {
    title: 'Download',
    lead: 'Pick a product, a version and your system. We guessed your system from your browser; switch it if you need another one.',
    product: 'Product',
    version: 'Version',
    system: 'System',
    detected: 'your system',
    latest: 'latest',
    changes: (v: string) => `What changed in ${v}`,
    changesOnGitHub: 'Release notes on GitHub',
    released: 'Released',
    noFiles: 'This version has no build for this system.',
    notReleased: 'This product isn’t out yet.',
    notReleasedBody: 'It’s being built in the open. Watch the repository on GitHub to hear when it ships.',
    comingSoon: 'Coming soon.',
    comingSoonBody: 'The first installer is being prepared. Watch the repository on GitHub to hear when it ships.',
    noReleases: 'No builds of this product are published yet.',
    unavailable: 'We couldn’t load the release list. Every installer is also on GitHub Releases.',
    checksum: 'SHA-256',
    sums: 'Checksums (SHA256SUMS.txt)',
    allReleases: 'All releases on GitHub',
    firstLaunch: 'First launch',
    firstLaunchLead: 'Prism isn’t signed with a paid developer certificate yet, so your system asks once before opening it.',
    steps: {
      win: 'SmartScreen says “Windows protected your PC”. Choose More info, then Run anyway.',
      mac: 'Open the .dmg and drag Prism to Applications. Open it once, then go to System Settings → Privacy & Security → Open Anyway.',
      linux: 'AppImage: make it executable (chmod +x) and run it. Debian or Ubuntu: sudo apt install ./Prism-*.deb. Saving keys needs GNOME Keyring or KWallet.'
    } satisfies Record<Os, string>,
    upgrade: 'Coming from Prompter? Install Prism over it. Your settings, keys and history stay where they are. On a Mac, delete the old Prompter.app afterwards.',
    noscript: 'The picker needs JavaScript. Here are the latest Spectrum files:'
  },
  docs: { title: 'Docs', lead: 'Setting Prism up, getting a key, and what to do when something doesn’t work.' },
  how: {
    title: 'How Prism works',
    lead: 'A look under the hood, from the keyboard shortcut to the copied prompt.'
  },
  footer: {
    license: 'MIT License',
    security: 'Security',
    changelog: 'Changelog',
    source: 'Source code',
    disclaimer: 'Model names belong to their owners. Prism isn’t affiliated with Anthropic, Google, OpenAI or xAI.'
  }
}

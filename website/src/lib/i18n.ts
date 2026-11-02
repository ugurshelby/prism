import type { GenId, Lang, Platform } from './site'

const en = {
  meta: {
    title: 'Prism: prompts written for the model you use',
    description:
      'Prism rewrites your rough prompt for Claude, GPT, Gemini or Grok, recommends the right model and effort level, and runs on your own API key. Free and open source for Windows, macOS and Linux.'
  },
  nav: { versions: 'Versions', download: 'Download', docs: 'Docs', github: 'GitHub', lang: 'Türkçe' },
  cta: {
    download: 'Download',
    downloadFor: 'Download for',
    allDownloads: 'All downloads',
    otherPlatforms: 'Other platforms',
    github: 'View on GitHub',
    free: 'Free and open source · MIT · Windows, macOS, Linux',
    mobile: 'Prism is a desktop app for Windows, macOS and Linux.'
  },
  os: {
    win: 'Windows',
    macArm: 'macOS (Apple Silicon)',
    macIntel: 'macOS (Intel)',
    appimage: 'Linux (AppImage)',
    deb: 'Linux (.deb)'
  } satisfies Record<Platform, string>,
  hero: {
    eyebrow: 'Prism Spectrum · for Claude, GPT, Gemini and Grok',
    title: ['Write it rough.', 'Get it written for your model.'],
    lead: 'Prism reads what you want, picks the right model and effort level, asks what is missing, and writes the prompt a senior engineer would write for Claude, GPT, Gemini or Grok. Your keys, your machine, no middleman.'
  },
  steps: {
    title: 'From a rough idea to a ready prompt',
    items: [
      { title: 'Write it your way', body: 'Any language, any order, half a thought. Pick a family or let Prism compare all of them.' },
      { title: 'Review the recommendation', body: 'Model, effort level and the reasoning behind them, plus a few questions when something is unclear.' },
      { title: 'Copy and paste', body: 'A prompt shaped for your coding agent, chat app or API call, with the exact settings to use.' }
    ]
  },
  families: {
    title: 'One app, four model families',
    lead: 'Each family is guided by knowledge cards distilled from its vendor’s official prompting guide.'
  },
  features: {
    title: 'Built to stay out of your way',
    items: [
      { icon: 'target', title: 'Model and effort, chosen for you', body: 'Claude effort, GPT and Grok reasoning effort, Gemini thinking level: only the levels each model supports.' },
      { icon: 'surface', title: 'Written for where you paste it', body: 'Coding agents like Claude Code, Codex, Antigravity and Grok Build, chat apps, or the API.' },
      { icon: 'key', title: 'Your keys, verified', body: 'Vertex AI, Google AI Studio, Anthropic, OpenAI or xAI. Prism checks a key the moment you add it.' },
      { icon: 'cross', title: 'Cross-family recommendation', body: 'Ask for the best model across every family you can actually use, never one you can’t.' },
      { icon: 'tray', title: 'Always within reach', body: 'Global hotkey, always-on-top panel, a tiny orb when collapsed, tray menu and notifications.' },
      { icon: 'history', title: 'Searchable history', body: 'Your last 200 prompts on this computer, tagged by model and engine. Copy again or rewrite.' }
    ]
  },
  privacy: {
    title: 'Private by design',
    body: 'Keys are encrypted by your operating system and never leave the app’s main process. Prompts go only to the provider you chose. No account, no telemetry, no server of ours.',
    link: 'Read the security policy'
  },
  generations: {
    title: 'Every version has a name',
    lead: 'Light through a prism: from a single ray to the full spectrum, and beyond.',
    status: { retired: 'Retired', current: 'Current', planned: 'Planned' },
    items: {
      ray: { tagline: 'A single beam', body: 'Prompts for Claude only, written by one engine. Where it all started.' },
      spectrum: { tagline: 'The beam, split', body: 'Claude, GPT, Gemini and Grok. Bring your own key from five providers and get the best model you can use.' },
      lens: { tagline: 'Many models, one focus', body: 'Big tasks split into workflows across the models and tools you own, with a prompt for every step.' },
      iris: { tagline: 'Beyond text', body: 'Prompts for image, video, audio and 3D generation models, in a workspace shaped by the tools you use.' }
    } satisfies Record<GenId, { tagline: string; body: string }>,
    features: {
      ray: ['Claude Fable, Opus, Sonnet and Haiku', 'Model and effort recommendation', 'Engine: Gemini on Vertex AI', 'Windows'],
      spectrum: [
        'Claude, GPT, Gemini and Grok targets',
        'Engines: Vertex AI, AI Studio, Anthropic, OpenAI, xAI',
        'Live key check and model discovery',
        'Coding agent, chat and API surfaces',
        'Tray, hotkey, notifications, history',
        'Windows, macOS and Linux'
      ],
      lens: ['Multi-model workflows', 'Setup that knows your tools and plans', 'Smart engine routing across your keys'],
      iris: ['Image, video, audio and 3D models', 'A workspace limited to the models you enable']
    } satisfies Record<GenId, string[]>,
    releases: 'Releases',
    noDownloads: 'No installers published.',
    more: 'Compare versions'
  },
  download: {
    title: 'Download Prism',
    lead: 'Pick your system. Every file is built from the open source code by GitHub Actions and smoke-tested before release.',
    latest: 'Latest',
    file: 'File',
    size: 'Size',
    checksum: 'SHA-256',
    allReleases: 'All releases on GitHub',
    sums: 'Checksums (SHA256SUMS.txt)',
    unavailable: 'Release data could not be loaded. Get the installers from GitHub Releases.',
    older: 'Earlier releases',
    firstLaunch: 'First launch',
    firstLaunchLead: 'Prism isn’t signed with a paid developer certificate yet, so your system asks for confirmation once.',
    steps: {
      win: 'SmartScreen shows “Windows protected your PC”: choose More info → Run anyway.',
      mac: 'Open the .dmg, drag Prism to Applications and open it. Then go to System Settings → Privacy & Security → Open Anyway.',
      linux: 'AppImage: make it executable (chmod +x) and run it. Debian/Ubuntu: sudo apt install ./Prism-*.deb. Saving keys needs GNOME Keyring or KWallet.'
    },
    upgrade: 'Upgrading from Prompter? Install Prism over it: your settings, keys and history stay. On macOS, delete the old Prompter.app afterwards.'
  },
  docs: { title: 'Docs', lead: 'Everything you need to set up Prism and get great prompts out of it.' },
  footer: {
    license: 'MIT License',
    security: 'Security',
    changelog: 'Changelog',
    source: 'Source code',
    disclaimer: 'Model names are trademarks of their owners. Prism is not affiliated with Anthropic, Google, OpenAI or xAI.'
  }
}

type Dict = typeof en

const tr: Dict = {
  meta: {
    title: 'Prism: kullandığın modele göre yazılmış promptlar',
    description:
      'Prism ham promptunu Claude, GPT, Gemini ya da Grok için yeniden yazar, doğru modeli ve seviyeyi önerir ve kendi API key’inle çalışır. Windows, macOS ve Linux için ücretsiz ve açık kaynak.'
  },
  nav: { versions: 'Sürümler', download: 'İndir', docs: 'Belgeler', github: 'GitHub', lang: 'English' },
  cta: {
    download: 'İndir',
    downloadFor: 'İndir:',
    allDownloads: 'Tüm indirmeler',
    otherPlatforms: 'Diğer sistemler',
    github: 'GitHub’da incele',
    free: 'Ücretsiz ve açık kaynak · MIT · Windows, macOS, Linux',
    mobile: 'Prism Windows, macOS ve Linux için bir masaüstü uygulaması.'
  },
  os: {
    win: 'Windows',
    macArm: 'macOS (Apple Silicon)',
    macIntel: 'macOS (Intel)',
    appimage: 'Linux (AppImage)',
    deb: 'Linux (.deb)'
  },
  hero: {
    eyebrow: 'Prism Spectrum · Claude, GPT, Gemini ve Grok için',
    title: ['Ham hâliyle yaz.', 'Modeline göre yazılmışını al.'],
    lead: 'Prism ne istediğini okur, doğru modeli ve seviyeyi seçer, eksik olanı sorar ve Claude, GPT, Gemini ya da Grok için deneyimli bir mühendisin yazacağı promptu yazar. Key’ler senin, bilgisayar senin, arada kimse yok.'
  },
  steps: {
    title: 'Ham fikirden hazır prompta',
    items: [
      { title: 'Nasıl düşünüyorsan öyle yaz', body: 'Türkçe, dağınık, yarım bir fikir; fark etmez. Bir aile seç ya da Prism hepsini karşılaştırsın.' },
      { title: 'Öneriyi gözden geçir', body: 'Model, seviye ve gerekçesi; bir şey belirsizse birkaç kısa soru.' },
      { title: 'Kopyala, yapıştır', body: 'Kodlama ajanına, sohbet uygulamasına ya da API çağrına göre biçimlenmiş prompt ve kullanılacak ayarlar.' }
    ]
  },
  families: {
    title: 'Tek uygulama, dört model ailesi',
    lead: 'Her aile, üreticisinin resmî prompt rehberinden damıtılmış bilgi kartlarıyla yönlendirilir.'
  },
  features: {
    title: 'Yoluna çıkmamak için tasarlandı',
    items: [
      { icon: 'target', title: 'Model ve seviye senin için seçilir', body: 'Claude effort, GPT ve Grok reasoning effort, Gemini thinking level: yalnızca modelin desteklediği seviyeler.' },
      { icon: 'surface', title: 'Yapıştıracağın yere göre yazılır', body: 'Claude Code, Codex, Antigravity, Grok Build gibi kodlama ajanları, sohbet uygulamaları ya da API.' },
      { icon: 'key', title: 'Key’lerin doğrulanır', body: 'Vertex AI, Google AI Studio, Anthropic, OpenAI ya da xAI. Prism key’i eklediğin anda dener.' },
      { icon: 'cross', title: 'Aileler arası öneri', body: 'Kullanabildiğin bütün aileler arasından en iyi modeli iste; kullanamadığın bir model asla önerilmez.' },
      { icon: 'tray', title: 'Hep elinin altında', body: 'Genel kısayol, her zaman üstte panel, küçülünce minik bir küre, tray menüsü ve bildirimler.' },
      { icon: 'history', title: 'Aranabilir geçmiş', body: 'Son 200 promptun bu bilgisayarda, model ve motorla etiketli. Tekrar kopyala ya da yeniden yaz.' }
    ]
  },
  privacy: {
    title: 'Gizlilik baştan düşünüldü',
    body: 'Key’ler işletim sisteminin şifrelemesiyle saklanır ve uygulamanın ana sürecinden çıkmaz. Promptlar yalnızca seçtiğin sağlayıcıya gider. Hesap yok, telemetri yok, bizim bir sunucumuz yok.',
    link: 'Güvenlik politikasını oku'
  },
  generations: {
    title: 'Her sürümün bir adı var',
    lead: 'Prizmadan geçen ışık: tek bir ışından bütün tayfa, ve ötesine.',
    status: { retired: 'Emekli', current: 'Güncel', planned: 'Planlandı' },
    items: {
      ray: { tagline: 'Tek ışın', body: 'Yalnızca Claude için prompt, tek motor. Her şeyin başladığı yer.' },
      spectrum: { tagline: 'Renklerine ayrılan ışın', body: 'Claude, GPT, Gemini ve Grok. Beş sağlayıcıdan kendi key’ini getir, kullanabildiğin en iyi modeli al.' },
      lens: { tagline: 'Çok model, tek odak', body: 'Büyük işler, sahip olduğun model ve araçlara yayılan iş akışlarına bölünür; her adım için ayrı prompt.' },
      iris: { tagline: 'Metnin ötesi', body: 'Görsel, video, ses ve 3D üretim modelleri için prompt; kullandığın araçlara göre şekillenen bir çalışma alanı.' }
    },
    features: {
      ray: ['Claude Fable, Opus, Sonnet ve Haiku', 'Model ve seviye önerisi', 'Motor: Vertex AI üzerinde Gemini', 'Windows'],
      spectrum: [
        'Claude, GPT, Gemini ve Grok hedefleri',
        'Motorlar: Vertex AI, AI Studio, Anthropic, OpenAI, xAI',
        'Anında key kontrolü ve model keşfi',
        'Kodlama ajanı, sohbet ve API yüzeyleri',
        'Tray, kısayol, bildirim, geçmiş',
        'Windows, macOS ve Linux'
      ],
      lens: ['Çok modelli iş akışları', 'Araçlarını ve aboneliklerini bilen kurulum', 'Key’lerin arasında akıllı motor yönlendirme'],
      iris: ['Görsel, video, ses ve 3D modelleri', 'Yalnızca açtığın modellerle sınırlı çalışma alanı']
    },
    releases: 'Yayınlar',
    noDownloads: 'Kurulum dosyası yayınlanmadı.',
    more: 'Sürümleri karşılaştır'
  },
  download: {
    title: 'Prism’i indir',
    lead: 'Sistemini seç. Her dosya açık kaynak koddan GitHub Actions ile derlenir ve yayından önce duman testinden geçer.',
    latest: 'Son sürüm',
    file: 'Dosya',
    size: 'Boyut',
    checksum: 'SHA-256',
    allReleases: 'GitHub’daki tüm yayınlar',
    sums: 'Sağlama değerleri (SHA256SUMS.txt)',
    unavailable: 'Sürüm bilgisi alınamadı. Kurulum dosyalarını GitHub Releases’tan indirebilirsin.',
    older: 'Önceki yayınlar',
    firstLaunch: 'İlk açılış',
    firstLaunchLead: 'Prism henüz ücretli bir geliştirici sertifikasıyla imzalı değil; sistemin bir kez onay ister.',
    steps: {
      win: 'SmartScreen “Windows bilgisayarınızı korudu” der: Ek bilgi → Yine de çalıştır.',
      mac: '.dmg’yi aç, Prism’i Uygulamalar’a sürükle ve aç. Sonra Sistem Ayarları → Gizlilik ve Güvenlik → Yine de Aç.',
      linux: 'AppImage: çalıştırılabilir yap (chmod +x) ve aç. Debian/Ubuntu: sudo apt install ./Prism-*.deb. Key saklamak için GNOME Keyring ya da KWallet gerekir.'
    },
    upgrade: 'Prompter’dan mı geçiyorsun? Prism’i üzerine kur: ayarların, key’lerin ve geçmişin korunur. macOS’ta sonra eski Prompter.app’i sil.'
  },
  docs: { title: 'Belgeler', lead: 'Prism’i kurmak ve ondan iyi promptlar almak için gereken her şey.' },
  footer: {
    license: 'MIT Lisansı',
    security: 'Güvenlik',
    changelog: 'Değişiklikler',
    source: 'Kaynak kod',
    disclaimer: 'Model adları sahiplerinin ticari markalarıdır. Prism’in Anthropic, Google, OpenAI ya da xAI ile bir bağı yoktur.'
  }
}

export const t = (lang: Lang): Dict => (lang === 'tr' ? tr : en)

import type { ProductId, ProductStatus, Lang, Os, Platform } from './site'

const en = {
  meta: {
    title: 'Prism: prompts written for the model you actually use',
    description:
      'Prism is a free desktop app that turns a rough request into a prompt written for Claude, GPT, Gemini or Grok. It suggests the model and effort level, asks what’s missing, and runs on your own API key.'
  },
  nav: { products: 'Products', download: 'Download', how: 'How it works', docs: 'Docs', github: 'GitHub', lang: 'Türkçe' },
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

type Dict = typeof en

const tr: Dict = {
  meta: {
    title: 'Prism: kullandığın modele göre yazılmış promptlar',
    description:
      'Prism, ham bir isteği Claude, GPT, Gemini ya da Grok için yazılmış bir prompta çeviren ücretsiz bir masaüstü uygulaması. Modeli ve seviyeyi önerir, eksik olanı sorar ve kendi API key’inle çalışır.'
  },
  nav: { products: 'Ürünler', download: 'İndir', how: 'Nasıl çalışır', docs: 'Belgeler', github: 'GitHub', lang: 'English' },
  cta: {
    download: 'İndir',
    downloadFor: (os: string) => `${os} için indir`,
    otherPlatforms: 'Diğer sistemler',
    github: 'Koda bak',
    free: 'Ücretsiz ve açık kaynak. MIT lisansı, hesap yok, telemetri yok.',
    mobile: 'Prism, Windows, macOS ve Linux için bir masaüstü uygulaması.'
  },
  os: { win: 'Windows', mac: 'macOS', linux: 'Linux' },
  platform: {
    win: 'Windows kurulumu (x64)',
    macArm: 'Apple Silicon (M1 ve sonrası)',
    macIntel: 'Intel Mac',
    appimage: 'AppImage (her dağıtım)',
    deb: '.deb (Debian, Ubuntu)'
  },
  hero: {
    eyebrow: 'Prism · Windows, macOS, Linux',
    title: ['Ne istediğini yaz.', 'Promptu Prism yazsın.'],
    lead: 'İşi nasıl anlatıyorsan öyle yaz. Prism bir model ve seviye seçer, belirsiz bir şey varsa bir iki soru sorar ve Claude, GPT, Gemini ya da Grok için yazılmış promptu geri verir. Kendi API key’inle, kendi bilgisayarında çalışır.'
  },
  steps: {
    title: 'Üç adım, bir dakika kadar',
    items: [
      {
        title: 'Ham hâliyle yaz',
        body: 'Yarım bir cümle de olur, Türkçe de. Bir model ailesi seç ya da Prism kullandığın hepsine baksın.'
      },
      {
        title: 'Seçime bak',
        body: 'Modeli, seviyeyi ve nedenini görürsün. İş belirsizse Prism yazmadan önce sorar.'
      },
      {
        title: 'Kopyala',
        body: 'Prompt gideceği yere göre yazılır: kodlama ajanı, sohbet penceresi ya da API çağrısı. Kullanman gereken ayarlar da yanında gelir.'
      }
    ]
  },
  families: {
    title: 'Claude, GPT, Gemini ve Grok',
    lead: 'Her ailenin kendi kuralları var. Claude Opus’a verdiğin prompt, GPT’nin ya da Gemini’nin istediği prompt değil.'
  },
  features: {
    title: 'Başka neler yapıyor',
    items: [
      {
        icon: 'target',
        title: 'Model ve seviye işe göre seçilir',
        body: 'Claude’da effort, GPT ve Grok’ta reasoning effort, Gemini’de thinking level. Prism yalnızca modelde gerçekten olan seviyeleri gösterir.'
      },
      {
        icon: 'surface',
        title: 'Gideceği yere göre yazılır',
        body: 'Claude Code, Codex, Antigravity ve Grok Build için yazılan prompt, sohbet penceresine ya da API çağrısına yazılandan farklıdır.'
      },
      {
        icon: 'key',
        title: 'Key anında denenir',
        body: 'Google AI Studio, Vertex AI, Anthropic, OpenAI ya da xAI key’ini yapıştır. Prism dener ve ulaşabildiği modelleri listeler.'
      },
      {
        icon: 'cross',
        title: 'Yalnızca kullanabildiğin modeller',
        body: 'Çapraz mod aileleri karşılaştırır ama sende olmayan bir modeli önermez.'
      },
      {
        icon: 'tray',
        title: 'Bir kısayol uzağında',
        body: 'Bir kısayolla açılır (Ray’de Ctrl+Alt+Space, Spectrum’da Ctrl+Shift+Space). Hep üstte durur, küçülünce minik bir küreye döner, tray’de bekler.'
      },
      {
        icon: 'history',
        title: 'Aranabilir geçmiş',
        body: 'Son 200 promptun bu bilgisayarda kalır; model ve motorla etiketli.'
      }
    ]
  },
  privacy: {
    title: 'Key’lerin bilgisayarında kalır',
    body: 'Key’ler ve geçmiş işletim sisteminin şifrelemesiyle saklanır. Promptlar doğrudan seçtiğin sağlayıcıya gider; sağlayıcının ne sakladığını onun koşulları belirler. Bizim bir sunucumuz yok; bizim tarafta kaydedilecek bir şey de yok.',
    link: 'Güvenlik politikası'
  },
  products: {
    title: 'Dört ürün',
    lead: 'Prism, aynı motoru paylaşan küçük bir masaüstü uygulamaları ailesi. Çalışma biçimine uyanı seç. Adlarını, ışığın bir prizmanın içinde yaptıklarından alıyorlar.',
    status: { available: 'İndirilebilir', soon: 'Yakında', planned: 'Planda' },
    items: {
      ray: {
        tagline: 'Tek ışın',
        body: 'Tek model ailesi, sade. Claude, GPT, Gemini ya da Grok’tan birini bir kez seç; Prism bütün promptları onun için yazar.',
        who: 'Tek bir ailede kalan ve en az kurulum isteyenler için.'
      },
      spectrum: {
        tagline: 'Işın renklerine ayrıldı',
        body: 'Birden çok aile, tek prompt. Kullandığın aileleri seç; Prism aralarından en uygun modeli önerir ve onun için tek bir prompt yazar.',
        who: 'Birden fazla aile kullanan ve aralarındaki seçimi Prism’e bırakmak isteyenler için.'
      },
      lens: {
        tagline: 'Tek istek, çok oturum',
        body: 'Büyük bir işi modellere ve paralel oturumlara böler; yalnızca bölmek kazandırıyorsa. Her oturuma ötekilerin ne yaptığını söyler.',
        who: 'Aynı anda birkaç model ya da kodlama oturumu çalıştıran geliştiriciler için.'
      },
      iris: {
        tagline: 'Metnin ötesi',
        body: 'Görsel, video, ses ve 3D modelleri için prompt; her birinden istediğin sonucu almanın en iyi yolu da yanında.',
        who: 'Üretken modellerle görsel, video, müzik ya da 3D üretenler için.'
      }
    },
    features: {
      ray: ['Tek hedef aile: Claude, GPT, Gemini ya da Grok', 'O ailenin içinde model ve seviye önerisi', 'Motor key’ini kendin getirirsin', 'Aileyi istediğin zaman ayarlardan değiştirirsin'],
      spectrum: [
        'Kullandığın aileleri seçersin',
        'Aralarından tek model önerir, tek prompt verir',
        'Motorlar: Vertex AI, AI Studio, Anthropic, OpenAI, xAI',
        'Key eklerken denenir',
        'Kodlama ajanı, sohbet ve API promptları'
      ],
      lens: ['Bir işi yalnızca kazandırıyorsa böler', 'Her oturumun promptu ötekilerin ne yaptığını ve hangi dosyalara dokunmaması gerektiğini söyler', 'Planda'],
      iris: ['Görsel, video, ses ve 3D modelleri', 'En iyi sonucun yolunu söyler: referans görsel, en-boy oranı, süre, seed', 'Planda']
    },
    get: (name: string) => `İndir · ${name}`,
    notYet: 'Henüz çıkmadı',
    versions: (n: number) => `${n} yayın`,
    noBuilds: 'Henüz yayın yok',
    openPage: (name: string) => `${name} hakkında`,
    page: {
      who: 'Kimin için',
      shared: 'Bütün ürünler aynı motoru, aynı şifreli key deposunu ve aynı bilgi kartlarını paylaşır. Key’lerin bilgisayarında kalır, promptlar doğrudan seçtiğin sağlayıcıya gider.',
      plannedNote: 'Planda. Henüz indirme yok; çalışma GitHub’da açıkça yürüyor.',
      soonNote: 'İlk kurulum dosyası hazırlanıyor. Yakında tekrar bak ya da depoyu GitHub’da takip et.',
      all: 'Bütün ürünler',
      downloadPage: 'İndirme sayfasına git',
      moved: 'Bu sayfanın adı artık Ürünler.'
    }
  },
  download: {
    title: 'İndir',
    lead: 'Bir ürün, bir yayın ve sistemini seç. Sistemini tarayıcından tahmin ettik; başka biri lazımsa değiştir.',
    product: 'Ürün',
    version: 'Yayın',
    system: 'Sistem',
    detected: 'senin sistemin',
    latest: 'en yeni',
    changes: (v: string) => `${v} ile gelenler`,
    changesOnGitHub: 'GitHub’daki yayın notları',
    released: 'Yayın tarihi',
    noFiles: 'Bu yayında bu sistem için dosya yok.',
    notReleased: 'Bu ürün henüz çıkmadı.',
    notReleasedBody: 'Açık kaynak olarak yapılıyor. Çıktığında haberin olsun istersen depoyu GitHub’da takip et.',
    comingSoon: 'Yakında.',
    comingSoonBody: 'İlk kurulum dosyası hazırlanıyor. Çıktığında haberin olsun istersen depoyu GitHub’da takip et.',
    noReleases: 'Bu ürünün henüz yayınlanmış bir dosyası yok.',
    unavailable: 'Yayın listesini yükleyemedik. Bütün kurulum dosyaları GitHub Releases’ta da var.',
    checksum: 'SHA-256',
    sums: 'Sağlama değerleri (SHA256SUMS.txt)',
    allReleases: 'GitHub’daki bütün yayınlar',
    firstLaunch: 'İlk açılış',
    firstLaunchLead: 'Prism henüz ücretli bir geliştirici sertifikasıyla imzalı değil; sistemin açmadan önce bir kez sorar.',
    steps: {
      win: 'SmartScreen “Windows bilgisayarınızı korudu” der. Ek bilgi’yi, sonra Yine de çalıştır’ı seç.',
      mac: '.dmg’yi aç, Prism’i Uygulamalar’a sürükle. Bir kez açmayı dene, sonra Sistem Ayarları → Gizlilik ve Güvenlik → Yine de Aç.',
      linux: 'AppImage: çalıştırılabilir yap (chmod +x) ve aç. Debian ya da Ubuntu: sudo apt install ./Prism-*.deb. Key saklamak için GNOME Keyring ya da KWallet gerekir.'
    },
    upgrade: 'Prompter’dan mı geliyorsun? Prism’i üzerine kur. Ayarların, key’lerin ve geçmişin yerinde kalır. Mac’te sonra eski Prompter.app’i sil.',
    noscript: 'Seçici JavaScript ister. En yeni Spectrum dosyaları şunlar:'
  },
  docs: { title: 'Belgeler', lead: 'Prism’i kurmak, key almak ve bir şey çalışmadığında yapılacaklar.' },
  how: {
    title: 'Prism nasıl çalışır',
    lead: 'Kaputun altına bir bakış: klavye kısayolundan kopyalanan prompta kadar.'
  },
  footer: {
    license: 'MIT Lisansı',
    security: 'Güvenlik',
    changelog: 'Değişiklikler',
    source: 'Kaynak kod',
    disclaimer: 'Model adları sahiplerine aittir. Prism’in Anthropic, Google, OpenAI ya da xAI ile bir bağı yok.'
  }
}

export const t = (lang: Lang): Dict => (lang === 'tr' ? tr : en)

import type { Lang } from '../lib/site'

// Her yayının kısa değişiklik notu (CHANGELOG.md ile aynı içerik, iki dilde); anahtar yayının etiketidir (ray-v2.0.0 ile
// eski v2.0.0 karışmasın). Yeni bir sürüm çıkınca buraya eklenir; eklenmezse sitede GitHub'daki yayın notlarına bağlantı gösterilir.
export const CHANGES: Record<string, Record<Lang, string[]>> = {
  'v2.1.0': {
    en: [
      'Prompter is now called Prism. Installing over Prompter keeps your settings, keys and history.',
      'This website, with downloads for every edition and system.',
      'Release names carry the edition: “Prism Spectrum 2.1.0”.'
    ],
    tr: [
      'Prompter’ın adı artık Prism. Prompter’ın üzerine kurunca ayarların, key’lerin ve geçmişin olduğu gibi kalır.',
      'Bu site: her sürüm ve her sistem için indirme.',
      'Yayın adlarında artık sürüm de yazıyor: “Prism Spectrum 2.1.0”.'
    ]
  },
  'v2.0.0': {
    en: [
      'Prompts for four families: Claude, GPT, Gemini and Grok.',
      'Bring your own key from Vertex AI, Google AI Studio, Anthropic, OpenAI or xAI. Keys are checked when you save them.',
      'Cross mode recommends the best model among the ones you can actually use.',
      'Installers for Windows, macOS and Linux. Released under the name Prompter.'
    ],
    tr: [
      'Dört aile için prompt: Claude, GPT, Gemini ve Grok.',
      'Vertex AI, Google AI Studio, Anthropic, OpenAI ya da xAI’dan kendi key’in. Key kaydederken denenir.',
      'Çapraz mod, gerçekten kullanabildiğin modeller arasından en uygununu önerir.',
      'Windows, macOS ve Linux kurulum dosyaları. Prompter adıyla yayınlandı.'
    ]
  },
  'v1.0.0': {
    en: [
      'The first Prism, packaged for Windows, macOS and Linux.',
      'Prompts for Claude Fable, Opus, Sonnet and Haiku, written by Gemini on Vertex AI.',
      'Installs next to Spectrum as a separate app. Needs a Vertex AI key and a Google Cloud project ID.'
    ],
    tr: [
      'İlk Prism; Windows, macOS ve Linux için paketlendi.',
      'Claude Fable, Opus, Sonnet ve Haiku için prompt; yazan model Vertex AI üzerinde Gemini.',
      'Spectrum’un yanına ayrı bir uygulama olarak kurulur. Vertex AI key’i ve Google Cloud proje ID’si ister.'
    ]
  }
}

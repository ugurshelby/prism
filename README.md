# Prompter

Ham promptunu yazarsın; Prompter onu analiz edip hedef model için yeniden yazar. **Claude, OpenAI (ChatGPT / GPT), Gemini ve Grok** ailelerini tanır: uygun modeli ve effort / reasoning / thinking seviyesini önerir, gerekirse birkaç netleştirme sorusu sorar, sonra o model, seviye ve yüzey (kodlama ajanı, sohbet, API) için optimize edilmiş, kopyalanmaya hazır promptu yazar. Windows ve macOS'ta çalışan, her zaman üstte durabilen, küçültülebilen bir masaüstü widget'ı (Electron + React + TypeScript).

Prompter iki ayrı model kullanır:

| Rol | Ne | Nasıl seçilir |
|---|---|---|
| **Motor** | Analizi, öneriyi ve yazımı yapan model; Prompter'ın kendisi çağırır | Ayarlar → Prompter motoru. Key'ini eklediğin sağlayıcılardan biri (Vertex AI, Anthropic, Google AI Studio, OpenAI, xAI). |
| **Hedef** | Promptun yazıldığı model; promptu kopyalayıp oraya sen verirsin | Ana ekranda ekosistem (✦ Çapraz / Claude / GPT / Gemini / Grok), yüzey ve "Önerilsin / Ben seçeyim". |

## Kurulum (kaynaktan)

Gereksinimler: Node.js 22+, Git ve en az bir sağlayıcının API key'i.

```bash
git clone <repo-url> prompter
cd prompter
npm install
npm run setup
npm run dev
```

`npm run setup` Node sürümünü denetler, Electron ikilisi inmemişse indirir ve `.env.example` dosyasını `.env` olarak kopyalar (var olan `.env`'e dokunmaz). İlk açılışta hiç sağlayıcı tanımlı değilse Prompter bir kurulum ekranı gösterir: key'i oradan girip doğrulayabilirsin.

## Sağlayıcılar ve key'ler

Yalnızca kullandığın sağlayıcıyı doldurman yeterli. Key'i ya Ayarlar → Sağlayıcılar'dan gir ya da `.env` dosyasına yaz.

| Sağlayıcı | `.env` değişkeni | Key nereden | Erişilen hedef aile |
|---|---|---|---|
| Vertex AI | `VERTEX_API_KEY`, `VERTEX_PROJECT_ID`, `VERTEX_LOCATION=global` | Google Cloud Console → APIs & Services → Credentials (Vertex AI API etkin olmalı) | Gemini |
| Anthropic | `ANTHROPIC_API_KEY` | platform.claude.com → API keys | Claude |
| Google AI Studio | `GEMINI_API_KEY` | aistudio.google.com/apikey | Gemini |
| OpenAI | `OPENAI_API_KEY` | platform.openai.com/api-keys | OpenAI (GPT) |
| xAI | `XAI_API_KEY` | console.x.ai | Grok |

- **Vertex AI** için proje ID'si de gerekir (Ayarlar'daki proje alanı ya da `VERTEX_PROJECT_ID`). Konum `global` kalmalı: `gemini-4-argon` bölgesel uç noktalarda 404 verir. Ayrıntılar: [docs/vertex-ai-gemini-kurulumu.md](docs/vertex-ai-gemini-kurulumu.md).
- **Öncelik sırası:** Ayarlar'dan kaydedilen key → ortam değişkeni → `.env`. Geliştirmede proje kökündeki `.env`, kurulu sürümde kullanıcı klasöründeki `.env` okunur (Windows: `%APPDATA%\Prompter\.env`, macOS: `~/Library/Application Support/Prompter/.env`).

### Key güvenliği

- Arayüzden girilen key, işletim sisteminin şifrelemesiyle (Windows DPAPI, macOS Keychain; Electron `safeStorage`) kullanıcı klasöründe `<sağlayıcı>.key` dosyasına yazılır. Proje klasörüne yazılmaz.
- Key yalnızca ana süreçte kullanılır: arayüze hiç gönderilmez (yalnızca `••••ab12` biçiminde maskeli hâli), derlenen arayüz paketine girmez, hata mesajlarından ve loglardan ayıklanır.
- `.env`, `.env.*` ve `*.key` git dışında tutulur (`.gitignore`). `.env.example` yalnızca boş şablondur.
- OpenAI ve xAI istekleri `store: false` ile gönderilir.

### Model keşfi

Bir key kaydedildiğinde ya da "Doğrula ve modelleri getir"e basıldığında Prompter bağlantıyı dener ve o key'in eriştiği metin modellerini listeler (Anthropic, OpenAI, xAI ve AI Studio'da model listesi uç noktası; Vertex'te API key ile liste çalışmadığı için bilinen modeller tek tek kısa bir istekle yoklanır). Sonuç kullanıcı klasöründeki `models.json` dosyasında saklanır ve:

- Ayarlar'da motorun analiz / yazım modeli için seçenek olarak gösterilir,
- çapraz önerinin aday havuzunu belirler (aşağıya bak).

Key'i olup hiç doğrulanmamış sağlayıcılar uygulama açılışında bir kez arka planda doğrulanır.

### Motor seçimi

Ayarlar → Prompter motoru → Sağlayıcı: "Otomatik" iken Vertex tanımlıysa Vertex (Gemini 4 Argon), değilse doğrulanmış ilk sağlayıcı kullanılır. Her sağlayıcı için analiz ve yazım modelleri ayrı seçilebilir; varsayılanlar:

| Sağlayıcı | Analiz | Yazım |
|---|---|---|
| Vertex AI | `gemini-4-argon` | `gemini-4-argon` |
| Anthropic | `claude-sonnet-5-5` | `claude-opus-5-5` |
| Google AI Studio | `gemini-3.8-flash` | `gemini-4-argon` |
| OpenAI | `gpt-6.1-sol` | `gpt-6-astra` |
| xAI | `grok-4.7` | `grok-4.7` |

Varsayılan model key'in erişiminde yoksa keşfedilen listeden en uygun olan seçilir. "Motoru test et" seçili motora kısa bir istek gönderir.

## Hedef ekosistemler ve öneri

- **Claude / GPT / Gemini / Grok:** Öneri yalnızca o ailenin modelleri arasından yapılır. Elle seçimde modeller ve o modelin desteklediği seviyeler gösterilir (Claude `effort`, Gemini `thinking level`, OpenAI ve Grok `reasoning effort`; Grok Build'de seviye sabittir).
- **✦ Çapraz:** Aday havuzu, doğrulanmış key'lerin eriştiği hedef modeller ile Ayarlar → Hedef ekosistem'de "key olmadan kullanıyorum" diye işaretlediğin uygulamalardan (ör. Claude aboneliğiyle Claude Code, ChatGPT uygulaması) oluşur. Havuz boşsa tüm katalog kullanılır.
- **Yüzey:** Kodlama ajanı (Claude Code, Codex, Antigravity, Grok Build), sohbet (claude.ai, ChatGPT, Gemini, Grok) ya da API. Sonuç ekranında hedef araçta modeli ve seviyeyi nasıl ayarlayacağın yazar.

Prompt her zaman İngilizce yazılır; "Modelin sana yanıt dili" ayarı içine bir dil satırı ekler.

## Kullanım

- `Ctrl+Shift+Space` (macOS'ta `Cmd+Shift+Space`) pencereyi gösterir ya da gizler; kısayol Ayarlar'dan değişir.
- Kapat düğmesi pencereyi tray'e gizler. Tray menüsünde göster/gizle, küçült, Geçmiş, Ayarlar, aktif motor ve çıkış vardır. Pencere gizliyken biten yazım için sistem bildirimi gösterilir (Ayarlar → Pencere).
- "Oturum açılışında başlat" açıksa Prompter oturum açılışında tray'de gizli başlar.
- Başlıktaki raptiye her zaman üstte kalmayı açıp kapatır; küçült düğmesi paneli sürüklenebilir bir küreye çevirir.
- Geçmiş (saat simgesi): her analiz bir kayıt açar, o analizden yapılan her yazım kayda eklenir. Kayıtlar hedef aile, model, effort, yüzey ve yazımı yapan motorla etiketlenir; aileye göre süzülebilir ve aranabilir. En fazla 200 kayıt kullanıcı klasöründeki `history.json` dosyasında tutulur.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run setup` | İlk kurulum: Node sürümü, Electron ikilisi, `.env` şablonu |
| `npm run dev` | Geliştirme modu (sıcak yenileme) |
| `npm run selftest -- "prompt"` | Arayüz açmadan analiz + yazımı gerçek sağlayıcıya karşı çalıştırır. Seçenekler: `--family=auto\|claude\|openai\|gemini\|grok`, `--surface=agent\|chat\|api`, `--engine=vertex\|anthropic\|gemini\|openai\|xai` |
| `npm run selftest -- --discover` | Tanımlı key'leri doğrular, erişilen modelleri, hedef erişimini ve motoru listeler |
| `npm run typecheck` | Tip kontrolü |
| `npm run build` | Derleme (`out/`) |
| `npm run mock` | Arayüzü Electron olmadan, sahte verilerle tarayıcıda açar (`#setup`: ilk kurulum ekranı) |
| `npm run icons` | `resources/` altındaki ikonları yeniden üretir |
| `npm run dist:win` / `dist:mac` | Kurulum paketi (`release/`) |

Gerçek ayar ve geçmişine dokunmadan denemek için ayrı bir kullanıcı klasörü ver:

```bash
PROMPTER_USER_DATA=./tmp-userdata npm run dev
```

## Normal uygulama olarak kurma

```bash
npm run dist:win
```

`release/Prompter Setup <sürüm>.exe` dosyasını çalıştır (macOS'ta `npm run dist:mac` → `.dmg`). Paket imzasızdır: Windows SmartScreen ve macOS Gatekeeper ilk açılışta uyarır (macOS'ta sağ tık → Aç). Kurulum eskisinin üzerine yazar; ayarlar, key'ler ve geçmiş kullanıcı klasöründe kalır. Bilgi kartları kurulum klasörüne kopyalanır; `knowledge/` altındaki değişiklikler yeniden paketleyene kadar kurulu sürüme yansımaz.

v1'den geçişte ayarlar otomatik taşınır (varsayılan ekosistem Claude kalır) ve eski `settings.json` / `history.json` bir kez `*.v1.json` olarak yedeklenir.

## Bilgi tabanı (`knowledge/`)

Motorun system talimatına giren kartlar, her istekte diskten okunur (düzenlediğin kart bir sonraki istekte geçerli olur):

```
knowledge/
  vision.md            Prompter'ın iyi prompt anlayışı (tüm aileler)
  routing.md           Çapraz öneride aileler arası seçim
  <aile>/              claude, openai, gemini, grok
    models.md          Güncel modeller, fiyat, seviyeler, model seçimi
    effort.md          Seviyeler ve promptun seviyeye göre değişimi
    principles.md      Ailenin resmî prompt rehberinden damıtılmış ilkeler
    surfaces/          agent.md, chat.md, api.md
    targets/<model>.md Modele özgü davranışlar ve işe yarayan kalıplar
```

Yeni bir hedef model eklemek için: `src/shared/catalog.ts` içinde `MODEL_IDS` ve `MODELS`'e ekle, `knowledge/<aile>/targets/<model-id>.md` kartını yaz ve gerekirse `models.md` tablosunu güncelle.

## Yapı

- `src/main/` — Electron ana süreci: pencere, tray, kısayol, bildirimler (`index.ts`, `window.ts`), ayarlar (`config.ts`), key / keşif / motor seçimi (`providers.ts`), sağlayıcı istemcileri (`llm/`), motor (`engine/analyze.ts`, `engine/generate.ts`), geçmiş (`history.ts`)
- `src/preload/` — arayüze açılan güvenli köprü
- `src/renderer/` — React arayüzü
- `src/shared/` — model kataloğu, aileler, sağlayıcılar, tipler
- `knowledge/` — bilgi kartları
- `docs/` — kaynak dokümanlar (Claude dokümanlarının yerel kopyası, Vertex kurulumu)

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| `npm run dev` Electron bulamıyor | `npm run setup` (npm script'leri kapalıysa Electron ikilisi inmemiş olabilir) |
| Vertex `404` | `VERTEX_LOCATION=global` olmalı; proje ID'sini ve model ID'sini kontrol et |
| `401` / `403` | Key yanlış ya da ilgili API etkin değil; Ayarlar'dan key'i yenile ve "Doğrula"ya bas |
| `429` | Kota doldu; Prompter iki kez artan beklemeyle tekrar dener, sonra hatayı gösterir |
| "Bu sistemde güvenli depolama kullanılamıyor" | İşletim sisteminin anahtar deposu yok (bazı Linux masaüstleri); key'i `.env` ile ver |
| Motor "yapılandırılmamış" | En az bir sağlayıcıya key ekle; Vertex için proje ID'si de gerekir |

## Veri ve gizlilik

Promptların yalnızca seçtiğin motor sağlayıcısına gönderilir. Geçmiş, ayarlar ve keşfedilen model listesi yalnızca bu bilgisayarda, kullanıcı klasöründe tutulur.

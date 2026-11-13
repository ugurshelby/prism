<div align="center">

<img src="resources/icon.png" width="96" alt="Prism logosu" />

# Prism

**Ham promptunu yaz, kullanacağın modele göre yeniden yazılmış hâlini al.**

Prism, promptunu **Claude, GPT, Gemini ya da Grok** için yeniden yazan küçük bir masaüstü uygulamaları ailesi.
Doğru modeli ve seviyeyi önerir, gerekirse birkaç netleştirme sorusu sorar ve kodlama ajanına, sohbet uygulamasına
ya da API çağrına yapıştırmaya hazır promptu yazar. Kendi API key'inle çalışır; araya başka bir sunucu girmez.

[![CI](https://github.com/ugurshelby/prism/actions/workflows/ci.yml/badge.svg)](https://github.com/ugurshelby/prism/actions/workflows/ci.yml)
[![Son sürüm](https://img.shields.io/github/v/release/ugurshelby/prism?label=indir)](https://github.com/ugurshelby/prism/releases/latest)
[![Platformlar](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#kurmak-istiyorum)
[![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-green.svg)](LICENSE)

**[Web sitesi ve indirme](https://ugurshelby.github.io/prism/tr/)** · [English](README.md) · **Türkçe**

<img src="docs/screenshots/compose.png" width="270" alt="Ham promptu yaz ve ekosistemi seç" />
<img src="docs/screenshots/review.png" width="270" alt="Model ve seviye önerisi" />
<img src="docs/screenshots/result.png" width="270" alt="Kopyalanmaya hazır prompt" />

</div>

## Özellikler

- **Dört model ailesi.** Claude (Fable, Opus, Sonnet, Haiku), OpenAI (GPT-6 Astra, GPT-6.1 Sol/Terra,
  GPT-6 Luna), Gemini (4 Argon, 3.8 Flash, 3.5 Flash-Lite) ve Grok (4.7, 4.3, Build). Kurallar her üreticinin resmî
  prompt rehberinden damıtılıp düzenlenebilir [bilgi kartlarına](knowledge/) yazıldı.
- **Model ve seviye önerisi.** Prism görevi okuyup model ve seviyeyi (Claude `effort`, OpenAI/Grok
  `reasoning effort`, Gemini `thinking level`) gerekçesi ve eminlik oranıyla önerir. "✦ Çapraz" seçilirse
  erişebildiğin tüm aileler arasından seçer.
- **Yapıştıracağın yere göre yazılır.** Kodlama ajanları (Claude Code, Codex, Antigravity, Grok Build), sohbet
  uygulamaları ya da API. Sonuç ekranı modeli ve seviyeyi hedef araçta nasıl ayarlayacağını da söyler.
- **Key'lerin anında doğrulanır.** Vertex AI, Google AI Studio, Anthropic, OpenAI ya da xAI key'i ekle; Prism
  hemen dener ve erişebildiği modelleri listeler.
- **Yoluna çıkmaz.** Her zaman üstte duran panel, genel kısayol, küçülünce sürüklenebilir küre, tray menüsü, prompt
  hazır olunca bildirim, oturum açılışında başlatma ve aranabilir geçmiş.
- **Gizlilik baştan düşünüldü.** Key'ler ve geçmiş işletim sisteminin şifrelemesiyle saklanır. Telemetri yok, Prism
  sunucusu yok; promptlar yalnızca seçtiğin sağlayıcıya gider (sağlayıcının ne sakladığı için
  [Güvenlik ve gizlilik](#güvenlik-ve-gizlilik)).

> Arayüz Türkçe ve İngilizce; yazılan promptlar İngilizce.

## Ürünler

Prism, aynı motorun birkaç uygulamada kullanılması. Adlarını ışığın bir prizmanın içinde yaptıklarından alıyorlar.

| Ürün | Ne yapar | Durum |
|---|---|---|
| **Prism Ray** | Tek ışın. Tek model ailesi seçersin (Claude, GPT, Gemini ya da Grok); Prism bütün promptları onun için yazar. | Yakında. İlk kurulum dosyası hazırlanıyor. |
| **Prism Spectrum** | Işın renklerine ayrıldı. Kullandığın aileleri seçersin; Prism aralarından en uygun modeli önerir ve onun için tek bir prompt yazar. | **İndirilebilir.** [İndir](https://github.com/ugurshelby/prism/releases/latest) |
| **Prism Lens** | Büyük bir işi modellere ve paralel oturumlara böler; yalnızca bölmek kazandırıyorsa. Her oturuma ötekilerin ne yaptığını söyler. | Planda |
| **Prism Iris** | Görsel, video, ses ve 3D modelleri için prompt; her birinden istediğin sonucu almanın yolu da yanında. | Planda |

Ray ve Spectrum aynı koddan derlenir ama ayrı yayınlanır: her birinin kendi kurulum dosyası ve kendi yayın etiketi
(`ray-v…`, `spectrum-v…`) var. Yan yana kurulabilirler; ayarları, key'leri ve geçmişleri ayrıdır.
2.x yayınları (`v2.0.0` ile `v2.2.0` arası) Prism Spectrum'un geçmişidir. Prism'in 2.0'a kadarki adı *Prompter*'dı;
Spectrum'u Prompter'ın üzerine kurmak ayarlarını, key'lerini ve geçmişini korur.

## Kurmak istiyorum

Sistemine uygun kurulum dosyasını **[web sitesinden](https://ugurshelby.github.io/prism/tr/download/)** ya da
**[yayınlar sayfasından](https://github.com/ugurshelby/prism/releases)** indir. Dosya adları ürüne göre değişir:

| Sistem | Dosya |
|---|---|
| Windows 10/11 (x64) | `Prism-Ray-Setup-<sürüm>-x64.exe` |
| macOS, Apple Silicon (M1 ve sonrası) | `Prism-Ray-<sürüm>-mac-arm64.dmg` |
| Linux (x64) | `Prism-Ray-<sürüm>-linux-x86_64.AppImage` ya da `.deb` |

Prism Spectrum için `Ray` yerine `Spectrum` yaz. Spectrum'un 2.x yayınları eski adları kullanır
(`Prism-Setup-<sürüm>-x64.exe`, `Prism-<sürüm>-mac-x64.dmg` gibi); Intel Mac dosyası yalnızca orada var.

Kurulum dosyaları açık kaynak ama ücretli bir geliştirici sertifikasıyla imzalı değil; bu yüzden ilk açılışta bir
kez onay gerekir:

- **Windows:** SmartScreen "Windows bilgisayarınızı korudu" der → **Ek bilgi → Yine de çalıştır**.
- **macOS:** `.dmg`'yi aç, uygulamayı Uygulamalar'a sürükle, bir kez açmayı dene, sonra
  **Sistem Ayarları → Gizlilik ve Güvenlik → Yine de Aç**. (Alternatif: `xattr -dr com.apple.quarantine "/Applications/Prism Spectrum.app"`, uygulamanın kendi adıyla.)
- **Linux AppImage:** `chmod +x Prism-*.AppImage && ./Prism-*.AppImage`.
  **Debian/Ubuntu:** `sudo apt install ./Prism-*.deb`.
  Key saklamak için bir anahtarlık (GNOME Keyring ya da KWallet) gerekir; çoğu masaüstünde zaten vardır.

Her sürümde `SHA256SUMS.txt` bulunur. Kurulum dosyasının yanına indirip çalıştırmadan önce doğrula:

- **Windows (PowerShell):** `Get-FileHash .\<kurulum-dosyası>.exe -Algorithm SHA256` ve çıkan değeri `SHA256SUMS.txt` içindeki satırla karşılaştır.
- **macOS:** `shasum -a 256 -c SHA256SUMS.txt --ignore-missing`
- **Linux:** `sha256sum -c SHA256SUMS.txt --ignore-missing`

Prism günde bir kez yeni sürüm olup olmadığına bakar ve varsa haber verir. Kendi kendine bir şey indirmez ya da
kurmaz: bildirim yayın sayfasına bağlanır, yeni sürümü eskisinin üzerine sen kurarsın (ayarların, key'lerin ve
geçmişin korunur). Denetimi **Ayarlar → Güncellemeler**'den kapatabilirsin; ayrıntı için
[Güvenlik ve gizlilik](#güvenlik-ve-gizlilik).

Verilerini silmek için **Ayarlar → Veri → Tüm verilerimi sil**. Windows kaldırıcısı da veri klasörünün silinip
silinmeyeceğini sorar; varsayılan hayır.

## Geliştirmek istiyorum

Gereksinimler: [Node.js 22+](https://nodejs.org) ve Git.

```bash
git clone https://github.com/ugurshelby/prism.git
cd prism
npm ci
npm run setup     # Node'u denetler, gerekirse Electron'u indirir, .env.example'dan .env oluşturur
npm run dev
```

Bir ürünü derlemek için `npm run build:ray` ya da `npm run build:spectrum`. Kurulum dosyası üretmek için
`npm run dist:ray` ya da `npm run dist:spectrum`; sonuna hedefi ekle, örneğin `npm run dist:ray -- win`
(`win`, `mac`, `linux` ya da `dir`; çıktı `release/`). Commit öncesi `npm run precommit` lint, tip denetimi ve
testleri çalıştırır. Gerisi [Geliştirme](#geliştirme) bölümünde.

## Hızlı başlangıç

1. **Key ekle.** İlk açılışta kurulum ekranı gelir. Aşağıdaki sağlayıcılardan birinin key'ini yapıştırıp
   **Kaydet**'e bas; anında doğrulanır, yeşil durum motorun hazır olduğunu gösterir. Her sağlayıcının yanındaki
   **Key al** bağlantısı key sayfasını açar.
2. **Kullandığın uygulamaları işaretle.** Aynı ekranda abonelikle kullandığın ekosistemleri (ör. Claude Code,
   ChatGPT) işaretle; çapraz öneri bunları da hesaba katar.
3. **Yaz, gözden geçir, kopyala.** Ham promptunu yaz, `Ctrl+Enter`'a bas, öneriyi kontrol et, varsa soruları
   yanıtla ve son promptu kopyala.

## Sağlayıcılar ve API key'leri

Prism bir modeli **motor** olarak kullanır (analiz eder ve yazar) ve bir **hedef** model için yazar (promptu
yapıştıracağın model). Motor, key'ini eklediğin sağlayıcıda çalışır; tek key yeterli.

| Sağlayıcı | Key nereden | Motor modelleri | Açtığı hedefler |
|---|---|---|---|
| Google AI Studio | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Gemini | Gemini |
| Vertex AI | [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) | Gemini | Gemini |
| Anthropic | [platform.claude.com/settings/keys](https://platform.claude.com/settings/keys) | Claude | Claude |
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | GPT | GPT |
| xAI | [console.x.ai](https://console.x.ai) | Grok | Grok |

- **Doğrulama:** Key kaydedilince sağlayıcıya hafif bir istek gider ve o key'in kullanabildiği metin modelleri
  listelenir. Geçersiz key anlaşılır bir mesajla reddedilir. **Doğrula ve modelleri getir** kontrolü tekrarlar.
- **Motor seçimi:** Ayarlar → *Prism motoru*. "Otomatik", doğrulanmış sağlayıcıları (önce Vertex AI) tercih eder. Bir
  sağlayıcı seçtiysen ve key'i yoksa ya da okunamıyorsa, Prism başka sağlayıcıya geçmez, hata verir. Analiz ve yazım modelleri ayrı seçilebilir; **Motoru test et** kısa bir deneme isteği gönderir.
- **Vertex AI** için Google Cloud proje ID'si de gerekir (Ayarlar ya da `.env` içinde `VERTEX_PROJECT_ID`) ve projede Vertex AI
  API'si etkin olmalı. Konum `global` kalmalı; bazı modeller (ör. `gemini-4-argon`) bölgesel uç noktalarda yok.
- **Kurulu uygulama key'leri yalnızca şifreli depodan okur.** Ortam değişkenleri ve `.env` dosyaları düz metin olduğu
  için yalnızca geliştirme sürümü (`npm run dev`, `npm run selftest`) bunları okur ([`.env.example`](.env.example)).
  Eski bir sürümden kullanıcı klasöründe key'li bir `.env` kaldıysa Ayarlar, key'i oradan kaydedip dosyayı silmeni söyler.

## Nasıl çalışır

```
ham prompt ──► motor (senin key'in) ──► analiz: görev, en uygun model + seviye, sorular
                                   └──► hedef ailenin bilgi kartlarıyla yeniden yazım ──► kopyala
```

- **Ekosistem:** Tek ailede kalmak için Claude, GPT, Gemini ya da Grok; erişebildiğin modeller (doğrulanmış key'ler
  ve işaretlediğin uygulamalar) arasından seçtirmek için **✦ Çapraz**.
- **Yüzey:** Kodlama ajanı, sohbet ya da API. Promptun yapısı ve kurulum ipuçları buna göre değişir.
- **Önerilsin / Ben seçeyim:** Öneriyi al ya da modeli ve seviyeyi kendin seç; yalnızca modelin desteklediği
  seviyeler gösterilir.

## Günlük kullanım

- Prism Ray'de `Ctrl+Alt+Space`, Prism Spectrum'da `Ctrl+Shift+Space` (macOS'ta `Ctrl` yerine `Cmd`) paneli gösterir
  ya da gizler; Ayarlar'dan değişir.
- Pencereyi kapatmak Prism'i tray'e (macOS'ta menü çubuğuna) gizler. Tray menüsü geçmişi ve ayarları açar, aktif
  motoru gösterir.
- Raptiye paneli her zaman üstte tutar; küçült düğmesi onu sürüklenebilir küçük bir küreye çevirir.
- Geçmiş son 200 promptu bu bilgisayarda şifreli, aile, model, seviye ve motorla etiketli tutar; aileye göre süz, ara,
  tekrar kopyala ya da yeniden yaz. Ayarlar → *Gizlilik*'ten kapatılabilir.

## Güvenlik ve gizlilik

- **Key'ler** işletim sisteminin güvenli deposuyla (Windows DPAPI, macOS Keychain, Linux Secret Service/KWallet)
  şifrelenip yalnızca kullanıcı klasöründe saklanır. Loglara ve hata mesajlarına yazılmaz; key'leri ayırt edebilmen
  için arayüze yalnızca son dört karakter gelir. Anahtarlığı olmayan Linux'ta Prism key'i zayıf korumayla saklamak
  yerine kaydetmeyi reddeder.
- **Geçmiş** de aynı yolla şifrelenir. Eski sürümlerin düz metin geçmişi ilk açılışta şifreli depoya taşınır, sonra
  üzerine yazılıp silinir. Anahtarlık yoksa geçmiş yalnızca o oturum boyunca bellekte tutulur. Geçmişi kapatabilir,
  pencereyi ekran görüntüsünden ve ekran paylaşımından gizleyebilirsin (macOS ve Windows 10 2004 ve sonrası); ikisi de Ayarlar → *Gizlilik*'te.
- **Promptlar yalnızca seçtiğin motor sağlayıcısına** HTTPS ile ve yalnızca o sağlayıcının API sunucularına gider.
  Sağlayıcının ne sakladığını Prism değil, sağlayıcının koşulları belirler:
  - **Google AI Studio, ücretsiz kullanım:** Google prompt ve yanıtları ürünlerini geliştirmek için kullanabilir, insan
    inceleyiciler okuyabilir ([koşullar](https://aistudio.google.com/docs/terms)). Ücretsiz key'le gizli içerik
    gönderme; faturalandırılan bir proje ya da Vertex AI kullan.
  - **OpenAI ve xAI:** istekler `store: false` ile gider, yanıtlar uygulama durumu olarak saklanmaz. Sağlayıcı yine de
    kötüye kullanım denetimi için veri tutabilir (OpenAI: 30 güne kadar,
    [ayrıntı](https://developers.openai.com/api/docs/guides/your-data)).
  - **Anthropic, Vertex AI ve ücretli Gemini API:** her sağlayıcının veri kullanım koşullarına bak.
- Telemetri, hata raporu ve Prism sunucusu yok.
- **Güncelleme denetimi.** Prism günde bir kez GitHub'ın yayın arayüzüne tek bir istek gönderip daha yeni sürüm olup
  olmadığına bakar. İstekte key, prompt metni ya da hesap yoktur; yalnızca uygulama adı gider. Kendi kendine bir şey
  indirilmez ya da kurulmaz. Ayarlar → Güncellemeler'den kapatılır.
- **Sertleştirme:** izole (sandbox) arayüz, sıkı CSP, engellenmiş sayfa geçişi ve izinler, arayüzden gelen her isteğin
  doğrulanması, paketlenmiş sürümde Electron fuse'ları. CI her push'ta lint, tip denetimi, test, bağımlılık denetimi ve
  Semgrep taraması çalıştırır; action'lar sabitlendi, depoda push korumalı gizli bilgi taraması, Dependabot ve CodeQL açık.
- **Yerel tehdit modeli:** İşletim sisteminin güvenli deposu verini başka kullanıcı hesaplarından ve kopyalanmış
  dosyalardan korur; kendi hesabında çalışan zararlı yazılıma karşı korumaz (Windows'ta DPAPI, oturumundaki her programa
  çözer). Ayrıntı: [SECURITY.md](SECURITY.md#scope).

Ayrıntılar ve güvenlik açığını gizlice bildirme yolu: [SECURITY.md](SECURITY.md).

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| `401` / "key reddedildi" | Key yanlış ya da ilgili API etkin değil. Ayarlar'dan key'i yeniden gir ve Doğrula'ya bas. |
| Vertex `404` | Konum `global` olmalı; proje ID'sini ve Vertex AI API'sinin etkin olduğunu kontrol et. |
| `429` | Hız sınırı ya da kota. Prism iki kez dener, sonra hatayı gösterir. |
| Motor "yapılandırılmamış" | En az bir key ekle; Vertex için proje ID'si de gerekir. |
| Linux: "Sistem anahtarlığı bulunamadı" | GNOME Keyring ya da KWallet kurup aç, sonra Prism'i yeniden başlat. Anahtarlık olmadan key kaydedilemez. |
| "key'i .env dosyasında" | Eski sürüm key'leri `.env`'den okuyordu. Key'i Ayarlar → Sağlayıcılar'dan kaydet, sonra `.env` dosyasını sil. |
| `npm run dev` Electron'u bulamıyor | `npm run setup` çalıştır. |

## Geliştirme

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Sıcak yenilemeyle çalıştırır |
| `npm run mock` | Arayüzü sahte verilerle tarayıcıda açar (`#setup` ilk kurulum ekranı) |
| `npm run typecheck` | Ana süreç, preload ve arayüz için tip kontrolü |
| `npm run lint` / `npm test` | oxlint (tip duyarlı, güvenlik kuralları) / birim testleri (Vitest) |
| `npm run precommit` | Lint, tip denetimi ve testler bir arada |
| `npm run selftest -- "prompt"` | Arayüzsüz gerçek bir analiz → yazım turu (`--family`, `--surface`, `--engine`) |
| `npm run selftest -- --discover` | Tanımlı key'leri doğrular, erişilen modelleri listeler |
| `npx electron . --selftest --smoke` | Ağsız kontrol: uygulama açılıyor ve tüm bilgi kartlarını yüklüyor mu |
| `npm run build:ray` / `npm run build:spectrum` | Bir ürünü derler |
| `npm run dist:ray` / `npm run dist:spectrum` | `release/` klasörüne kurulum dosyası üretir (sonuna `-- win`, `mac`, `linux` ya da `dir`) |

Gerçek ayar ve geçmişine dokunmadan denemek için: `PRISM_USER_DATA=./tmp-userdata npm run dev`.

Prompt kalitesi [`knowledge/`](knowledge/) klasöründe: her aile için `principles.md`, `effort.md`, `models.md`, her
yüzey ve her hedef model için birer kart. Kartlar her istekte yeniden okunur. Bkz. [CONTRIBUTING.md](CONTRIBUTING.md).

Electron, React ve TypeScript ile yapıldı.

## Lisans

[MIT](LICENSE). Model adları sahiplerinin ticari markalarıdır; Prism'in Anthropic, Google, OpenAI ya da xAI ile
bir bağı yoktur.

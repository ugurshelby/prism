<div align="center">

<img src="resources/icon.png" width="96" alt="Prism logo" />

# Prism

**Write a rough prompt. Get one tuned for the exact model you'll use.**

A desktop widget that rewrites your prompt for **Claude, GPT, Gemini or Grok**: it picks the right model and
effort level, asks a couple of clarifying questions when needed, and writes a copy-ready prompt for your coding
agent, chat app or API call. Bring your own API key; nothing runs on someone else's server.

[![CI](https://github.com/ugurshelby/prism/actions/workflows/ci.yml/badge.svg)](https://github.com/ugurshelby/prism/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/ugurshelby/prism?label=download)](https://github.com/ugurshelby/prism/releases/latest)
[![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)](#install)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**[Website and downloads](https://ugurshelby.github.io/prism/)** · **English** · [Türkçe](README.tr.md)

<img src="docs/screenshots/compose.png" width="270" alt="Write a rough prompt and pick the ecosystem" />
<img src="docs/screenshots/review.png" width="270" alt="Model and effort recommendation" />
<img src="docs/screenshots/result.png" width="270" alt="Optimized prompt ready to copy" />

</div>

## Features

- **Four model families, one place.** Claude (Fable, Opus, Sonnet, Haiku), OpenAI (GPT-6 Astra, GPT-6.1 Sol/Terra,
  GPT-6 Luna), Gemini (4 Argon, 3.8 Flash, 3.5 Flash-Lite) and Grok (4.7, 4.3, Build). Rules come from each vendor's
  official prompting guide, distilled into editable [knowledge cards](knowledge/).
- **Model and effort recommendation.** Prism reads your task and suggests the model and level (Claude `effort`,
  OpenAI/Grok `reasoning effort`, Gemini `thinking level`) with its reasoning and a confidence score. Choose
  "✦ Cross" to compare across every family you have access to.
- **Written for where you'll paste it.** Coding agents (Claude Code, Codex, Antigravity, Grok Build), chat apps
  or the API. The result also tells you how to set that model and level in the target tool.
- **Your keys, verified.** Add a key for Vertex AI, Google AI Studio, Anthropic, OpenAI or xAI. Prism checks it
  right away and lists the models it can reach.
- **Stays out of the way.** Always-on-top panel, global hotkey, collapsible orb, tray menu, a notification when a
  prompt is ready, optional start at login, and a searchable history.
- **Private by design.** Keys are encrypted by your OS and never leave the main process. No telemetry, no backend.

> The interface is in Turkish today; generated prompts are written in English. Translations are welcome.

## Versions

Each major version of Prism has a name, following the path of light through a prism.

| Version | Name | What it does | Status |
|---|---|---|---|
| 1.x | **Ray** | A single beam: prompts for Claude only, one engine (Vertex AI) | Retired |
| 2.x | **Spectrum** | Splits the beam: Claude, GPT, Gemini and Grok, your own keys, cross-family recommendation | **Current** |
| 3.x | **Lens** | Focuses several models on one task: multi-model workflows | Planned |
| 4.x | **Iris** | Beyond text: image, video, audio and 3D generation models | Planned |

Prism was called *Prompter* until 2.0. Installing Prism over Prompter keeps your settings, keys and history.

## Install

Download the installer for your system from the **[website](https://ugurshelby.github.io/prism/download/)** or the
**[latest release](https://github.com/ugurshelby/prism/releases/latest)**:

| System | File |
|---|---|
| Windows 10/11 (x64) | `Prism-Setup-<version>-x64.exe` |
| macOS, Apple Silicon (M1 and later) | `Prism-<version>-mac-arm64.dmg` |
| macOS, Intel | `Prism-<version>-mac-x64.dmg` |
| Linux (x64) | `Prism-<version>-linux-x86_64.AppImage` or `Prism-<version>-linux-amd64.deb` |

The builds are open source but not signed with a paid developer certificate, so the first launch needs one extra step:

- **Windows:** SmartScreen shows "Windows protected your PC" → **More info → Run anyway**.
- **macOS:** open the `.dmg`, drag Prism to Applications, open it once, then go to
  **System Settings → Privacy & Security → Open Anyway**. (Alternative: `xattr -dr com.apple.quarantine /Applications/Prism.app`.)
- **Linux AppImage:** `chmod +x Prism-*.AppImage && ./Prism-*.AppImage`.
  **Debian/Ubuntu:** `sudo apt install ./Prism-*-linux-amd64.deb`.
  Key storage needs a keyring (GNOME Keyring or KWallet), which most desktops already have.

Each release includes `SHA256SUMS.txt` so you can verify your download. Installing a new version over an old one keeps
your settings, keys and history.

### Build from source

Requirements: [Node.js 22+](https://nodejs.org) and Git.

```bash
git clone https://github.com/ugurshelby/prism.git
cd prism
npm ci
npm run setup     # checks Node, downloads Electron if needed, creates .env from .env.example
npm run dev
```

To build an installer yourself: `npm run dist:win`, `npm run dist:mac` or `npm run dist:linux` (output in `release/`).

## Quick start

1. **Add a key.** On first launch Prism shows a setup screen. Paste an API key from any provider below and press
   **Kaydet** (Save). It is verified immediately; the green status means the engine is ready. Use the **Key al**
   link next to each provider to open its key page.
2. **Mark the apps you use.** In the same screen, tick the ecosystems you use through a subscription app
   (for example Claude Code or ChatGPT) so cross-family recommendations include them.
3. **Write, review, copy.** Type your rough prompt, press `Ctrl+Enter`, check the recommendation, answer any
   questions, and copy the final prompt.

## Providers and API keys

Prism uses one model as its **engine** (it analyzes and writes) and writes for a **target** model (the one you
paste the prompt into). The engine runs on whichever provider you add a key for; one key is enough.

| Provider | Get a key | Engine models | Unlocks targets |
|---|---|---|---|
| Google AI Studio | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Gemini | Gemini |
| Vertex AI | [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) | Gemini | Gemini |
| Anthropic | [platform.claude.com/settings/keys](https://platform.claude.com/settings/keys) | Claude | Claude |
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | GPT | GPT |
| xAI | [console.x.ai](https://console.x.ai) | Grok | Grok |

- **Verification:** saving a key sends a lightweight request to the provider and lists the text models that key can
  use. Invalid keys are rejected with a clear message. **Doğrula ve modelleri getir** (Verify) repeats the check.
- **Engine choice:** Settings → *Prism motoru*. "Auto" prefers Vertex AI when configured, otherwise the first
  verified provider. Analysis and writing models can be set separately; **Motoru test et** sends a short test request.
- **Vertex AI** also needs your Google Cloud project ID (Settings or `VERTEX_PROJECT_ID`) with the Vertex AI API
  enabled. Keep the location `global`, since some models (such as `gemini-4-argon`) are not served from regional endpoints.
- **Without the UI:** keys can also come from environment variables or a `.env` file (see [`.env.example`](.env.example)).
  Order: key saved in Settings → environment variable → `.env`. The installed app reads `.env` from its user data
  folder: `%APPDATA%\Prism` (Windows), `~/Library/Application Support/Prism` (macOS), `~/.config/Prism` (Linux);
  if you upgraded from Prompter, the same folder named `Prompter`.

## How it works

```
your rough prompt ──► engine (your key) ──► analysis: task, best model + level, questions
                                       └──► rewrite with the target family's knowledge cards ──► copy
```

- **Ecosystem:** pick Claude, GPT, Gemini or Grok to stay within one family, or **✦ Cross** to let the analysis choose
  among the models you can use (verified keys plus apps you marked).
- **Surface:** *Kodlama ajanı* (coding agent), *Sohbet* (chat) or *API*. The prompt's structure and the setup tips
  change accordingly.
- **"Önerilsin / Ben seçeyim":** take the recommendation, or choose the model and level yourself; only the levels the
  model supports are shown.

## Everyday use

- `Ctrl+Shift+Space` (`Cmd+Shift+Space` on macOS) shows or hides the panel; change it in Settings.
- Closing the window keeps Prism in the tray (menu bar on macOS). The tray menu opens history, settings and shows
  the active engine.
- The pin keeps the panel on top; the collapse button turns it into a small draggable orb.
- History keeps your last 200 prompts on this computer, tagged with family, model, level and engine; search and filter
  by family, copy again or rewrite.

## Security and privacy

- Keys are encrypted with the OS secure storage (Windows DPAPI, macOS Keychain, Linux Secret Service/KWallet), stored
  only in your user data folder, and never sent to the interface or written to logs. Linux without a keyring:
  Prism refuses to save keys rather than storing them weakly.
- Prompts go only to the engine provider you chose, over HTTPS. OpenAI and xAI requests are sent with `store: false`.
  No telemetry, no other servers.
- The app is hardened: sandboxed renderer, strict CSP, blocked navigation and permissions, Electron fuses in packaged
  builds. CI actions are pinned, and the repository uses secret scanning with push protection, Dependabot and CodeQL.

See [SECURITY.md](SECURITY.md) for details and how to report a vulnerability privately.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `401` / "key rejected" | Wrong key or the API isn't enabled for it. Re-enter the key in Settings and press Verify. |
| Vertex `404` | Location must be `global`; check the project ID and that the Vertex AI API is enabled. |
| `429` | Rate limit or quota. Prism retries twice, then shows the error. |
| Engine "yapılandırılmamış" (not configured) | Add at least one key; Vertex also needs a project ID. |
| Linux: "Sistem anahtarlığı bulunamadı" | Install/unlock GNOME Keyring or KWallet, or put the key in `~/.config/Prism/.env`. |
| `npm run dev` can't find Electron | Run `npm run setup`. |

## Development

| Command | What it does |
|---|---|
| `npm run dev` | Run with hot reload |
| `npm run mock` | Open the interface in a browser with fake data (`#setup` shows the first-run screen) |
| `npm run typecheck` / `npm run build` | Type-check / build into `out/` |
| `npm run selftest -- "prompt"` | One real analyze → write round trip without the UI (`--family`, `--surface`, `--engine`) |
| `npm run selftest -- --discover` | Verify configured keys and list reachable models |
| `npx electron . --selftest --smoke` | Offline check that the app boots and loads every knowledge card |
| `npm run dist:win` / `dist:mac` / `dist:linux` | Build installers into `release/` |

Use `PRISM_USER_DATA=./tmp-userdata npm run dev` to keep your real settings and history untouched.

Prompt quality lives in [`knowledge/`](knowledge/): per family `principles.md`, `effort.md`, `models.md`, one card
per surface and one per target model. Cards are re-read on every request. See [CONTRIBUTING.md](CONTRIBUTING.md).

Built with Electron, React and TypeScript.

## License

[MIT](LICENSE). Model names are trademarks of their respective owners; Prism is not affiliated with Anthropic,
Google, OpenAI or xAI.

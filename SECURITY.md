# Security Policy

## Supported versions

Only the latest release receives security fixes.

| Version | Supported |
|---|---|
| 2.x Spectrum (latest) | Yes |
| 1.x Ray | No. Still downloadable as a legacy build, but it gets no security fixes; use 2.x. |
| < 1.0 (Prompter 0.x) | No |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub: **Security → Report a vulnerability** on this repository
([direct link](https://github.com/ugurshelby/prism/security/advisories/new)). You can expect a first reply
within 7 days. Once a fix is released, the advisory is published with credit to you unless you prefer otherwise.

Useful details: affected version and OS, steps to reproduce, and what an attacker could achieve.

## Scope

In scope: anything that lets another website, another user account, a malicious prompt or a malicious provider
response read your keys or history, send your key to a server other than the provider's API, run code in Prism, or
make Prism send data somewhere you did not choose.

Out of scope:
- **Malware already running under your user account.** OS secure storage (Windows DPAPI, macOS Keychain, Linux
  Secret Service / KWallet) protects data from other accounts and from copied files. It does not stop a program
  running as you: on Windows, DPAPI decrypts for any process in your session. A compromised account is outside what a
  desktop app can defend.
- Physical access to an unlocked session, and debugging a development build (`npm run dev`).
- What an AI provider does with data you sent to it (see "How Prism handles your data").

## Never share your API keys

Prism never asks you to post keys anywhere. When filing issues, logs or screenshots, make sure no API key is
visible. If you exposed a key, revoke it in your provider's console right away.

## How Prism handles your data

- **API keys** are encrypted with the operating system's secure storage (Windows DPAPI, macOS Keychain,
  Linux Secret Service / KWallet) and stored only in your user data folder. They are never written to logs or error
  messages, and are not included in the app bundle. The interface only receives the last four characters, so you can
  tell keys apart. The installed app reads keys only from this encrypted storage; environment variables and `.env`
  files are read by development builds only. On Linux without a keyring, Prism refuses to save keys instead of
  storing them with weak protection.
- **History** (your last 200 prompts and results) is encrypted at rest with the same secure storage. Plain-text
  history from older versions is moved into encrypted storage on first launch, then overwritten and deleted. If
  secure storage is unavailable or locked, history is kept in memory only and is gone when you quit. History can be
  turned off in Settings; "clear history" also removes migrated archives.
- **Settings** stay in your user data folder as plain JSON. They contain no keys or prompts.
- **Prompts** are sent only to the provider you configured as the engine (Google, Anthropic, OpenAI or xAI), over
  HTTPS, and only to that provider's API hosts; redirects are refused. There is no telemetry, no crash reporting and
  no Prism server. Retention and training use are decided by the provider's terms:
  - Google AI Studio **free tier**: Google may use prompts and responses to improve its products, and human
    reviewers may read them ([Gemini API terms](https://aistudio.google.com/docs/terms)). Use a billed project or
    Vertex AI for confidential material.
  - OpenAI and xAI requests set `store: false` (responses are not kept as application state); abuse-monitoring
    retention may still apply ([OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data)).
  - Anthropic, Vertex AI and the paid Gemini API: see each provider's data usage terms.
- **Window:** an optional setting hides the Prism window from screenshots and screen sharing (macOS, and Windows 10 2004 or later; it has no effect on Linux).
- **User data folder:** `%APPDATA%\Prism`, `~/Library/Application Support/Prism`, `~/.config/Prism` (or a folder
  named `Prompter` if you upgraded from Prompter).
- **App hardening:**
  - sandboxed renderer with context isolation and a strict Content Security Policy;
  - navigation and new windows blocked, browser permissions denied;
  - every call from the interface checked for its origin and validated against a schema;
  - Electron fuses that disable `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and `--inspect` in packaged builds and only
    load the integrity-checked `app.asar`.

## Updates and download integrity

Prism has **no auto-updater** and never downloads or runs code by itself. Updates are manual: download the new
installer from the [releases page](https://github.com/ugurshelby/prism/releases) and install it over the old one.

The installers are not signed with a paid certificate. Every release includes `SHA256SUMS.txt`, built in the same CI
run as the installers. Verify before running:

- Windows (PowerShell): `Get-FileHash .\Prism-Setup-<version>-x64.exe -Algorithm SHA256`, then compare with
  `SHA256SUMS.txt`
- macOS: `shasum -a 256 -c SHA256SUMS.txt --ignore-missing`
- Linux: `sha256sum -c SHA256SUMS.txt --ignore-missing`

## Repository protections

Enabled on this repository:
- secret scanning with push protection;
- Dependabot alerts and updates;
- CodeQL code scanning;
- a ruleset that blocks force pushes to `main` and deletion of `main`.

CI runs lint, type checks, unit tests, a dependency audit and a Semgrep scan on every push to `main` and every pull request. Release builds run the audit, type checks, lint and tests again before packaging, and a published release is never overwritten. Workflows use read-only
tokens by default, with write access only where a step needs it, and actions are pinned by SHA.

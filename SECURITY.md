# Security Policy

## Supported versions

Only the latest release receives security fixes.

| Version | Supported |
|---|---|
| 2.x (latest) | Yes |
| < 2.0 | No |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub: **Security → Report a vulnerability** on this repository
([direct link](https://github.com/ugurshelby/prompter/security/advisories/new)). You can expect a first reply
within 7 days. Once a fix is released, the advisory is published with credit to you unless you prefer otherwise.

Useful details: affected version and OS, steps to reproduce, and what an attacker could achieve.

## Never share your API keys

Prompter never asks you to post keys anywhere. When filing issues, logs or screenshots, make sure no API key is
visible. If you exposed a key, revoke it in your provider's console right away.

## How Prompter handles your data

- **API keys** are encrypted with the operating system's secure storage (Windows DPAPI, macOS Keychain,
  Linux Secret Service / KWallet) and stored only in your user data folder. They are never sent to the interface,
  written to logs, or included in the app bundle. On Linux without a keyring, Prompter refuses to save keys instead
  of storing them with weak protection.
- **Prompts** are sent only to the provider you configured as the engine (Google, Anthropic, OpenAI or xAI), over
  HTTPS. OpenAI and xAI requests set `store: false`. There is no telemetry and no other server.
- **History and settings** stay in your user data folder (`%APPDATA%\Prompter`, `~/Library/Application Support/Prompter`,
  `~/.config/Prompter`).
- **App hardening:** sandboxed renderer with context isolation, a strict Content Security Policy, navigation and
  new windows blocked, browser permissions denied, and Electron fuses that disable `ELECTRON_RUN_AS_NODE`,
  `NODE_OPTIONS` and `--inspect` in packaged builds and only load the integrity-checked `app.asar`.

## Repository protections

Secret scanning with push protection, Dependabot alerts and updates, CodeQL code scanning, and a ruleset that blocks
force pushes and deletion of `main` are enabled. Workflows run with read-only tokens and pinned action SHAs.

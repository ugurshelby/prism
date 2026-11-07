# Changelog

Major versions are named: 1.x **Ray**, 2.x **Spectrum**, 3.x **Lens**, 4.x **Iris**.

## 2.2.0 — Spectrum

- **History is encrypted.** Prompt history is stored with the OS secure storage, the same way keys are. Older
  plain-text history is moved into encrypted storage on first launch, then overwritten and deleted.
- **Privacy settings:** turn history off, and hide the window from screenshots and screen sharing (Windows, macOS).
- **Keys stay where you put them.**
  - If the engine you picked has no usable key, Prism stops with a clear error instead of switching to another
    provider. Auto mode does the same when a saved key can't be read.
  - Keys are no longer trimmed or rewritten. A key with spaces or hidden characters is rejected with a message.
- **The installed app reads keys only from encrypted storage.** Environment variables and `.env` files work in
  development builds only. If an old `.env` with keys is left in your user data folder, Settings tells you to save
  the key in the app and delete the file.
- **Hardening:**
  - Every call from the interface is checked and validated.
  - Keyed requests go only to the provider's own API hosts over HTTPS, with redirects refused.
  - Provider responses are validated.
  - A malformed Vertex location could no longer redirect your key; this is fixed.
- **Fixes:**
  - Cancelling an analysis now stops the request.
  - Long streamed answers are no longer cut off by the request timeout.
  - A failed history write no longer loses a finished prompt.
  - Closing the window (for example with Alt+F4) hides it to the tray; if the window is ever gone, the hotkey and tray menu open it again.
  - On Linux, a failing autostart entry can no longer stop the app from starting.
- **Website:** download links are validated before use.
- **Docs:** README and SECURITY.md describe what each provider may keep, the local threat model, how to verify
  downloads with `SHA256SUMS.txt`, and that there is no auto-updater. 1.x Ray is marked as legacy without security
  fixes.

## 2.1.0 — Spectrum

- **Prompter is now Prism.** New name for the app, installers and repository (`ugurshelby/prism`; old links
  redirect). Installing over Prompter keeps settings, keys and history in the existing `Prompter` data folder.
  On macOS, delete the old `Prompter.app` after installing. If a saved key no longer appears, add it again.
- **Website** with OS-aware downloads, version overview and docs: https://ugurshelby.github.io/prism/
- Release titles carry the generation name ("Prism Spectrum 2.1.0").
- Developer environment variables renamed: `PRISM_USER_DATA`, `PRISM_CAPTURE`, `PRISM_CAPTURE_PROMPT`.

## 2.0.0 — Spectrum (released as Prompter 2.0.0)

- **Four target families:** prompts for Claude, OpenAI GPT, Google Gemini and xAI Grok, each guided by knowledge
  cards distilled from the vendor's official prompting guides.
- **Bring your own engine:** Vertex AI, Google AI Studio, Anthropic, OpenAI or xAI. Keys are verified on save and the
  accessible models are discovered automatically.
- **Cross-family recommendation:** with "auto", the analysis picks the best model among those you can actually use.
- **Interface adapts to the target:** model, effort scale and surface labels follow the chosen family; first-run
  setup screen; history tagged with family and engine, with filters.
- **Background use:** tray menu, notification when a prompt is ready while hidden, start hidden at login
  (including Linux autostart).
- **Installers for Windows, macOS (Apple Silicon and Intel) and Linux (AppImage, .deb)**, built and smoke-tested in CI.
- **Security:** OS-encrypted key storage (refuses weak storage on Linux), blocked navigation and permissions,
  Electron fuses, pinned CI actions, secret scanning and Dependabot.
- Settings and history from 1.x are migrated automatically; the originals are kept as `*.v1.json`.

## 0.1.0 — Ray (released as Prompter 0.1.0)

- First version: Claude 5.5 targets only, Vertex AI (Gemini 4 Argon) engine.

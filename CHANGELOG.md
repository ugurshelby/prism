# Changelog

Major versions are named: 1.x **Ray**, 2.x **Spectrum**, 3.x **Lens**, 4.x **Iris**.

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

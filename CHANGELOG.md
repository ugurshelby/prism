# Changelog

## 2.0.0

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

## 0.1.0

- First version: Claude 5.5 targets only, Vertex AI (Gemini 4 Argon) engine.

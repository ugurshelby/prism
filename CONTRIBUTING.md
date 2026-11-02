# Contributing

Thanks for helping improve Prompter! Issues and pull requests are welcome in English or Turkish.

## Development setup

Requirements: Node.js 22+ and Git.

```bash
git clone https://github.com/ugurshelby/prompter.git
cd prompter
npm ci
npm run setup     # downloads Electron if needed, creates .env from .env.example
npm run dev       # starts the app with hot reload
```

To keep your real settings and history untouched while developing, point the app to a scratch folder:

```bash
PROMPTER_USER_DATA=./tmp-userdata npm run dev
```

`npm run mock` opens the interface in a browser with fake data and no API calls.

## Before opening a pull request

```bash
npm run typecheck
npm run build
npx electron . --selftest --smoke     # offline: the app boots and loads every knowledge card
```

If you have a key configured, `npm run selftest` runs one real analyze → generate round trip.

- Keep pull requests focused; describe what changed and how you tested it.
- Match the surrounding code style. Code comments and UI strings are in Turkish.
- Never commit keys, `.env` files or screenshots that show keys. Secret scanning blocks pushes that contain them.

## Where things live

| Path | What |
|---|---|
| `src/main/` | Electron main process: engine, providers, key storage, history, tray |
| `src/main/llm/` | One client per provider (Vertex, AI Studio, Anthropic, OpenAI, xAI) |
| `src/renderer/` | React interface |
| `src/shared/catalog.ts` | Target models, effort levels, surfaces, providers |
| `knowledge/` | Prompting guidance cards per model family, read by the engine at runtime |

### Improving prompt quality

Most quality gains come from `knowledge/`. Each family (`claude`, `openai`, `gemini`, `grok`) has `principles.md`,
`effort.md`, `models.md`, one card per surface and one per target model. Cards are plain Markdown, re-read on every
request, so you can edit them and try again without rebuilding. Base changes on the vendors' official prompting
guides and keep cards short.

## Releasing (maintainers)

Bump `version` in `package.json`, update `CHANGELOG.md`, then push a tag:

```bash
git tag v2.1.0
git push origin v2.1.0
```

The Release workflow builds Windows, macOS and Linux installers, smoke-tests each packaged app and publishes them.

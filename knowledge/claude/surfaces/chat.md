---
kind: model
verified: 2026-11-10
sources: claude-best-practices, claude-github-integration, claude-prompting-sonnet, claude-prompting-haiku, claude-app-model-settings
---
# Surface: claude.ai / Claude Desktop chat

The prompt is a single chat message. The app can read files and repository contents the person attaches (uploads, the GitHub integration), but it can't edit the repository or run commands there. [s:claude-github-integration]

How to write it:
- Give the context and the reason behind the request, then state clearly and specifically what you want. [s:claude-best-practices]
- Put long material the person provides in labeled tags before the question. [s:claude-best-practices]
- Specify the form of the answer: length, structure (prose, list, table), audience, tone. [s:claude-best-practices]
- For questions whose answer may have changed (prices, rules, versions, anything "latest"), ask it to search and check current sources. [s:claude-prompting-sonnet, claude-prompting-haiku]

Setting model and effort: pick the model in the selector; if the app offers a thinking or effort control, use the recommended level. [s:claude-app-model-settings]

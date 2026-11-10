---
kind: model
verified: 2026-11-10
sources: claude-models-overview, claude-pricing, claude-effort, claude-code-model-config, claude-prompting-opus, claude-prompting-haiku, claude-prompting-fable, claude-code-best-practices, claude-prompting-sonnet
---
# Target models (Claude, lineup checked 2026-11-08 against docs retrieved 2026-10-23)

All four have a 1M-token context window, 128K max output, vision and tool use, and support five effort levels: `low`, `medium`, `high`, `xhigh`, `max`. [s:claude-models-overview, claude-effort]

| Model | ID | Positioning | Latency | Price (input / output per MTok) | Default effort (API) | Default effort (Claude Code) |
|---|---|---|---|---|---|---|
| Claude Fable 5.1 | `claude-fable-5-1` | Most capable. Demanding reasoning and long-horizon agentic work. | Slower | $10 / $50 | `high` | `high` | [s:claude-models-overview, claude-pricing, claude-effort, claude-code-model-config]
| Claude Opus 5.5 | `claude-opus-5-5` | Starting point for most serious work: agentic coding, knowledge work, code review, analysis. Thinking is always on. | Moderate | $4 / $20 | `medium` | `medium` | [s:claude-models-overview, claude-pricing, claude-effort, claude-code-model-config]
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | Best combination of speed and intelligence. Clearly scoped engineering, agentic and latency-sensitive work, chat. | Fast | $2 / $10 | `high` | `medium` | [s:claude-models-overview, claude-pricing, claude-effort, claude-code-model-config]
| Claude Haiku 5.5 | `claude-haiku-5-5` | Fastest and cheapest. Classification, extraction, routing, short tool tasks, simple chat, subagents. | Fastest | $0.10 / $0.50 (prompts over 100k: $0.50 / $2.50) | `medium` | `medium` | [s:claude-models-overview, claude-pricing, claude-effort, claude-code-model-config]

## Choosing a model
Choose the cheapest model and effort that reliably does the job well. [s:claude-effort]
- **Opus 5.5** for anything that needs real judgment: multi-file coding in a real repo, debugging an unclear failure, architecture, careful analysis, writing that must be right. At `medium` it matches or beats Opus 5 at `high` on coding and knowledge work. [s:claude-prompting-opus]
- **Sonnet 5.5** when the task is well specified and bounded: a clearly described feature, a focused fix, refactors with a clear target, drafting and editing, quick data work, or when speed matters most. [s:claude-models-overview]
- **Haiku 5.5** for simple, mechanical or high-volume work: format conversions, short factual answers, classification, extraction with a clear schema, small scripts. [s:claude-models-overview, claude-prompting-haiku]
- **Fable 5.1** only when the task is genuinely frontier-hard or very long-horizon; it costs 2.5 times Opus. [s:claude-models-overview, claude-pricing, claude-prompting-fable]
- Signals that push up: cases that are easy to overlook (a bug in unfamiliar code, a flaky test, a schema change with many readers), harder or longer agent tasks, long unattended runs, strict instruction following. Signals that push down: the person reviews each result, the task is simple or high-volume, the work is latency-sensitive chat. [s:claude-code-best-practices, claude-effort, claude-prompting-sonnet, claude-prompting-haiku]

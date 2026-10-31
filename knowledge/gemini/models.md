# Target models (Gemini, current lineup, October 2026)

All three take text, images, PDFs, audio and video natively and have a ~1M-token input window. Thinking is always on and is set with `thinking_level`; supported levels differ per model. Built-in tools: Google Search grounding, URL context, code execution, function calling (and they can be combined with structured outputs).

| Model | ID | Positioning | Price (input / output per MTok) | Thinking levels | Default |
|---|---|---|---|---|---|
| Gemini 4 Argon | `gemini-4-argon` | Flagship reasoning model. Unified 1M context and long decodes up to 1M tokens (background mode; synchronous requests cap output at 65,536). For the hardest reasoning. | $4 / $20 (introductory $2 / $10 until Nov 30, 2026) | `low` `medium` `high` | `medium` |
| Gemini 3.8 Flash | `gemini-3.8-flash` | Most intelligent Flash: long-horizon software engineering, autonomous agents, complex enterprise workflows. Uses more tokens on long, complex tasks by design; takes small steps, calls tools iteratively and checks its own work. Default model of the Antigravity agent. | $1.50 / $7.50 (introductory $0.75 / $3.75 until Dec 31, 2026) | `low` `medium` `high` | `medium` |
| Gemini 3.5 Flash-Lite | `gemini-3.5-flash-lite` | Fastest and most cost-effective, for high-throughput work. | $0.30 / $2.50 | `minimal` `low` `medium` `high` | `minimal` |

## Choosing a model

Google's own advice: 3.5 Flash-Lite or 3.8 Flash for most new work, Gemini 4 Argon for the hardest reasoning.

- **Gemini 4 Argon** for genuinely hard reasoning, very long documents or codebases read at once, and very long single outputs (whole reports or large generated files). Thinking can't be turned off.
- **Gemini 3.8 Flash** as the default for serious everyday work: multi-step coding and agent tasks, analysis, writing, multimodal understanding. Strong price/performance.
- **Gemini 3.5 Flash-Lite** for simple, mechanical or high-volume work: classification, extraction, routing, short answers, quick transformations.

Gemini's distinctive strengths: very long context, native video/audio/PDF understanding, and Google Search grounding for current information.

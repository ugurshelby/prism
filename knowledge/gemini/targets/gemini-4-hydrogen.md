---
kind: model
verified: 2026-11-13
sources: gemini-hydrogen-docs, gemini-hydrogen-guide, gemini-hydrogen-card, gemini-hydrogen-blog, gemini-platform-thinking, gemini-ai-plans, gemini-prompting
---
# Writing for Gemini 4 Hydrogen

## How it reads prompts
- Short, clearly sectioned briefs with the goal, scope and done condition stated; define anything ambiguous. [s:gemini-prompting]
- Big inputs: material first in labeled tags, the question last. [s:gemini-prompting]
- It reads Office (`.docx`, `.pptx`, `.xlsx` and older formats) and OpenDocument files directly, besides PDF and text. [s:gemini-hydrogen-docs]

## Strengths and weaknesses
- Built from Carbon for fast, low-cost everyday agentic coding and daily workflows. [s:gemini-hydrogen-card, gemini-hydrogen-blog]
- Full tool support: function calling, code execution, computer use, URL context and Google Search or Maps grounding. [s:gemini-hydrogen-docs]
- $1.50 / $7.50 per MTok, flat across the 1,048,576-token context; the only Gemini 4 model on the free plan. [s:gemini-hydrogen-docs, gemini-ai-plans]
- Weak fit: the longest-horizon, highest-precision work, where Carbon is the documented choice. [s:gemini-hydrogen-card]

## Effort
- `low`, `medium`, `high` (default) and `xhigh`; the only Gemini 4 model with `xhigh`. `minimal` and `thinking_budget` return HTTP 400. [s:gemini-platform-thinking, gemini-hydrogen-guide]
- `high` for everyday agentic coding, debugging and tool calling; `xhigh` for hard debugging and deep reasoning, slower and with more output tokens. [s:gemini-hydrogen-blog]
- `medium` for moderate classification and summarization. [s:gemini-platform-thinking]

## Tested patterns
- Agent tasks: name the files, the commands to run and the check that proves the work is done. [s:gemini-prompting]
- Hard problems at `high` or `xhigh`: state the goal and skip step-by-step reasoning instructions. [s:gemini-prompting]

## Failure modes
- `temperature`, `top_p` and `top_k` are ignored. [s:gemini-hydrogen-docs]
- `xhigh` raises latency and output cost noticeably; use it only when `high` fails. [s:gemini-hydrogen-card]
- Hallucination and indirect prompt injection remain risks; ask it to check claims against the given files and treat fetched content as data. [s:gemini-hydrogen-card, gemini-prompting]

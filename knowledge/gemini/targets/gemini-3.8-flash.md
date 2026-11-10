---
kind: model
verified: 2026-11-10
sources: gemini-prompting, gemini-models, gemini-thinking
---
# Writing for Gemini 3.8 Flash

## How it reads prompts
- Short, clearly sectioned briefs work better than long rule lists; define anything ambiguous. [s:gemini-prompting]
- Answers tersely by default; ask for detail, tone or format explicitly. [s:gemini-prompting]

## Strengths and weaknesses
- Strong: Google's most intelligent Flash model; good price-performance for coding and agents. [s:gemini-models]
- Other options: Google positions 4 Argon as its flagship reasoning model and 3.5 Flash-Lite as the fastest, cheapest choice for high-throughput work. [s:gemini-models]

## Effort
- `low`, `medium` (default), `high`; `minimal` is not supported. [s:gemini-thinking]
- `low` for latency-critical work, `medium` for complex code and agentic use, `high` for deep multi-step reasoning. [s:gemini-thinking]

## Tested patterns
- Agentic coding: goal, relevant files, done criteria and the verification command; plan before each action, separate reads from risky writes. [s:gemini-prompting]
- Narrow tasks: state the goal and the constraints, what it should and should not do ("only change X"). [s:gemini-prompting]

## Failure modes
- Sampling parameters are ignored and will become errors; leave them out. [s:gemini-prompting]
- Asking for visible step-by-step reasoning. [s:gemini-prompting]

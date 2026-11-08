---
kind: model
verified: 2026-11-08
sources: gemini-models, gemini-thinking, gemini-prompting
---
# Writing for Gemini 3.8 Flash

## How it reads prompts
- Short, clearly sectioned briefs work better than long rule lists; define anything ambiguous. [s:gemini-prompting]
- Answers tersely by default; ask for detail, tone or format explicitly. [s:gemini-prompting]

## Strengths and weaknesses
- Strong: Google's most intelligent Flash model; good price-performance for coding, agents, analysis and writing. [s:gemini-models]
- Weak fit: the very hardest reasoning (prefer Argon) and trivial high-volume jobs (prefer Flash-Lite). [unverified]

## Effort
- `low`, `medium` (default), `high`; `minimal` is not supported. [s:gemini-thinking]
- `low` for latency-critical work, `medium` for complex code and agentic use, `high` for deep multi-step reasoning. [s:gemini-thinking]

## Tested patterns
- Agentic coding: goal, relevant files, done criteria and the verification command; plan before each action, separate reads from risky writes. [s:gemini-prompting]
- Narrow tasks: state scope and the stopping condition ("only change X; stop when the test passes"). [unverified]

## Failure modes
- Sampling parameters are ignored and will become errors; leave them out. [s:gemini-prompting]
- Asking for visible step-by-step reasoning. [s:gemini-prompting]

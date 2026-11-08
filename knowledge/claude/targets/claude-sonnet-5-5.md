---
kind: model
verified: 2026-11-08
sources: claude-prompting-sonnet, claude-models-overview, claude-effort
---
# Writing for Claude Sonnet 5.5

## How it reads prompts
- Follows a well-specified brief efficiently; when asked for ideas it may start building unless told to stop at ideas. [s:claude-prompting-sonnet]

## Strengths and weaknesses
- Strong: speed with strong intelligence; efficient agentic coding on well-specified tasks; chat and latency-sensitive work. [s:claude-models-overview]
- Weak fit: ambiguous, judgment-heavy work where Opus 5.5 is the safer default. [unverified]

## Effort
- Default `high` on the API, `medium` in Claude Code. From `medium` up it thinks briefly before almost every reply. [s:claude-effort, claude-prompting-sonnet]

## Tested patterns
- Only the requested change: "When the work the user asked for is done and checked, stop and report. Don't add features, tests, files, docs or refactors that weren't asked for. If you think one would help, mention it at the end instead of doing it." [s:claude-prompting-sonnet]
- No extra review rounds at `xhigh`/`max`: "When the work the user asked for is done and its checks pass, stop and report. Don't start extra rounds of review or hardening on your own, and don't launch reviewer sub-agents unless the user asked for a review." [s:claude-prompting-sonnet]
- Ideas only: "When the user asks for ideas, options or a plan, give them that and stop. Don't start building or changing anything until they say to go ahead." [s:claude-prompting-sonnet]
- Keep going at low/medium: "Keep working until everything the user asked for is done, and only stop to ask when you can't go on without the user or before a risky step." [s:claude-prompting-sonnet]
- Real verification at `low`: "When you change code that can be run, built, or type-checked, run a real check that exercises the change before reporting it done." [s:claude-prompting-sonnet]
- Facts that change: "Use the search tool to check specifics that may have changed since your training, such as what is allowed, required or charged, even when you feel confident." [s:claude-prompting-sonnet]

## Failure modes
- Adds unrequested files (tests, docs, helpers) at every effort, more at high effort. [s:claude-prompting-sonnet]
- Reasoning tasks with JSON-only output at low/medium: it may answer without thinking; add "Think the problem through before you answer." [s:claude-prompting-sonnet]

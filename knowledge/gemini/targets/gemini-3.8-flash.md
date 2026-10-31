# Writing for Gemini 3.8 Flash

Strengths: Google's most intelligent Flash model; built for long-horizon software engineering, autonomous agents and complex enterprise workflows. It takes small reasoning steps, calls tools iteratively and checks its own work, and by design can use many tokens on long, complex tasks. Thinking levels `low`, `medium` (default), `high`; `minimal` is not supported.

## Patterns that work

- **Agentic coding:** goal, relevant files, done criteria and the verification command; Google's guidance for agents applies — plan before each action, separate low-risk reads from risky writes, retry transient errors but change strategy on real failures.
- **Bound the work:** because it keeps iterating, state scope and stopping conditions clearly for narrow tasks ("only change X; stop and report once the test passes").
- **Thinking level:** `low` for latency-critical work, `medium` for complex code and agentic use, `high` for deep reasoning, math and difficult multi-step tasks.
- **Concise prompts:** a short, clearly sectioned brief works better than a long rule list.

## Things to avoid
- `minimal` thinking (error), sampling parameters, prefilled model turns.
- Asking it to write its reasoning into the reply.

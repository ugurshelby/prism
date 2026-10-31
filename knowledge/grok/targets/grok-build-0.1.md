# Writing for Grok Build 0.1

Strengths: xAI's coding-agent model behind the Grok Build CLI; trained to act as an autonomous engineering agent — refactoring, invoking tools, producing structured outputs and iterating through multi-step tasks until completion. 256k context. Reasoning is always on at a fixed level (no effort setting). Early access.

## Patterns that work

- Write a clear engineering brief: goal and why, relevant files and commands, what done looks like, the verification command, and scope limits.
- Because it iterates until it considers the task complete, define the finish line precisely and say when to stop and report.
- Ask before destructive or irreversible actions.

## Things to avoid
- Prompts that depend on an effort setting — there is none.
- Non-coding tasks (writing, research, chat): recommend Grok 4.7 instead.

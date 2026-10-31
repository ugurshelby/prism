# Surface: Antigravity (Google's coding agent, IDE and CLI)

The prompt is a task message to an agent that can read and edit files and run commands and tests in the person's repository. Its agent defaults to Gemini 3.8 Flash, which takes small steps, calls tools iteratively and checks its own work.

How to write it:
- Lead with the goal and why, then the concrete task. Use the real names of files, folders, commands, errors and tests the person gave; never invent paths. Keep pasted errors and logs verbatim in a fenced block.
- Keep it concise and direct — Gemini over-analyzes long, heavily engineered prompts. A short brief with clear sections beats a long rule list.
- State what done looks like and how to verify it (which tests, build or command). At `low` add an explicit "run a real check before reporting done".
- Set scope: what not to touch, whether new dependencies are allowed, whether tests or docs should be added. Long-horizon Flash work can use many tokens; if the task is narrow, say so.
- Ask before destructive or hard-to-reverse actions (deleting files or branches, force-push, migrations on shared data).
- For investigation requests, the deliverable is the explanation; no fix until asked.
- Use one delimiter style (Markdown sections or XML tags), not a mix.

Setting model and thinking in Antigravity: choose the model in the model picker (`/model` in the CLI). If no thinking-level control is offered, the model default applies (`medium` on Argon and 3.8 Flash).

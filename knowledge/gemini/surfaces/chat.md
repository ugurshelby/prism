---
kind: model
verified: 2026-11-08
sources: gemini-prompting
---
# Surface: Gemini app (gemini.google.com / mobile)

The prompt is a single chat message. The app may offer Google Search and file uploads but has no access to the person's repository. [unverified]

How to write it:
- Open with the situation and goal in one or two sentences, then the request. [unverified]
- For long material, put it first in clearly labeled tags and ask the question at the end ("Based on the material above, …"). [s:gemini-prompting]
- Specify the form of the answer: length, structure, audience, tone. Gemini answers tersely by default; ask for detail or a conversational tone if wanted. [s:gemini-prompting]
- For anything time-sensitive, ask it to search and mention today's date. [s:gemini-prompting]
- Keep it conversational; no persuasive or flattering role declarations. [s:gemini-prompting]
- A simple question stays a simple message: don't turn a one-line request into a brief with sections. [unverified]

Setting model and thinking: pick the matching model in the app's model selector; if it offers a thinking control, use the recommended level. Picker labels change often. [unverified]

---
kind: model
verified: 2026-11-10
sources: gemini-app-upload, gemini-prompting, vertex-prompt-strategies, gemini-app-models
---
# Surface: Gemini app (gemini.google.com / mobile)

The prompt is a single chat message. The app accepts up to 10 uploaded files per prompt and, on the web, one imported code folder or GitHub repository per chat. [s:gemini-app-upload]

How to write it:
- State the goal clearly and concisely, then the request. [s:gemini-prompting]
- For long material, put it first in clearly labeled tags and ask the question at the end ("Based on the material above, …"). [s:gemini-prompting]
- Specify the form of the answer: length, structure, audience, tone. Gemini answers tersely by default; ask for detail or a conversational tone if wanted. [s:gemini-prompting]
- For anything time-sensitive, ask it to search and mention today's date. [s:gemini-prompting]
- Keep it conversational; no persuasive or flattering role declarations. [s:gemini-prompting]
- Keep a simple question a short message: avoid verbose phrasing and drop instructions that aren't essential. [s:vertex-prompt-strategies]

Setting model and thinking: tap the model at the bottom of the chat box (Flash-Lite, Flash, Pro, Argon, by plan) and pick a thinking level (Low, Medium, High; default Low). The choice persists for the conversation; options may change without notice. [s:gemini-app-models]

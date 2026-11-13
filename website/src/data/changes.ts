// Short change notes per release (same content as CHANGELOG.md); the key is the release tag (so ray-v2.0.0 and the
// old v2.0.0 do not clash). Add an entry when a new version ships; without one the site links to the GitHub release notes.
export const CHANGES: Record<string, string[]> = {
  'v2.1.0': [
    'Prompter is now called Prism. Installing over Prompter keeps your settings, keys and history.',
    'This website, with downloads for every edition and system.',
    'Release names carry the edition: “Prism Spectrum 2.1.0”.'
  ],
  'v2.0.0': [
    'Prompts for four families: Claude, GPT, Gemini and Grok.',
    'Bring your own key from Vertex AI, Google AI Studio, Anthropic, OpenAI or xAI. Keys are checked when you save them.',
    'Cross mode recommends the best model among the ones you can actually use.',
    'Installers for Windows, macOS and Linux. Released under the name Prompter.'
  ],
  'v1.0.0': [
    'The first Prism, packaged for Windows, macOS and Linux.',
    'Prompts for Claude Fable, Opus, Sonnet and Haiku, written by Gemini on Vertex AI.',
    'Installs next to Spectrum as a separate app. Needs a Vertex AI key and a Google Cloud project ID.'
  ]
}

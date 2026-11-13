import { createHash } from 'node:crypto'

/** path → SHA-256 hex of the shipped card, from scripts/knowledge-manifest.mjs. */
export type KnowledgeManifest = Readonly<Record<string, string>>

/**
 * Cards ship outside app.asar (extraResources), so the asar integrity fuse does not cover them. A build carries the
 * hash of every card; a changed, swapped or unlisted file is refused instead of reaching the model as instructions.
 * Without a manifest (development, tests) cards are read as they are, so edits under knowledge/ apply at once.
 */
export function cardIntact(path: string, bytes: Buffer, manifest: KnowledgeManifest | null): boolean {
  if (!manifest) return true
  const expected = Object.hasOwn(manifest, path) ? manifest[path] : undefined
  return !!expected && createHash('sha256').update(bytes).digest('hex') === expected
}

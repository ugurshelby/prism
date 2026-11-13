export type ReleaseProduct = 'ray' | 'spectrum'

export interface Asset {
  name: string
  url: string
  size: number
  sha256: string | null
}
export interface Release {
  tag: string
  product: ReleaseProduct
  version: string
  published: string
  url: string
  assets: Asset[]
}

export const REPO: string
export function parseTag(tag: unknown): { product: ReleaseProduct; version: string } | null
export function isReleaseUrl(raw: unknown): boolean
/** GitHub /releases response; throws if the shape is malformed. */
export function parseApiResponse(json: unknown): Release[]
/** Contents of releases.json; throws if the shape or a URL is malformed. */
export function parseStored(json: unknown): Release[]

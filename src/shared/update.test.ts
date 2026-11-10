import { describe, expect, it } from 'vitest'
import releases from './fixtures/github-releases.json'
import { CHECK_INTERVAL_MS, ReleaseListSchema, checkDue, newerRelease, parseVersion, releasePageUrl } from './update'

const list = ReleaseListSchema.parse(releases)

describe('newerRelease', () => {
  it('picks the highest published release of this product only', () => {
    expect(newerRelease(list, 'ray-v', '2.0.0')).toEqual({ tag: 'ray-v2.1.0', version: '2.1.0' })
    expect(newerRelease(list, 'spectrum-v', '3.0.0')).toEqual({ tag: 'spectrum-v3.1.0', version: '3.1.0' })
  })

  it('ignores drafts, prereleases, malformed and old-scheme tags', () => {
    expect(newerRelease(list, 'ray-v', '2.1.0')).toBeNull()
    expect(newerRelease(list, 'v', '2.2.0')).toBeNull()
  })

  it('compares numerically, not as text', () => {
    const l = ReleaseListSchema.parse([{ tag_name: 'ray-v2.10.0', draft: false, prerelease: false }])
    expect(newerRelease(l, 'ray-v', '2.9.0')?.version).toBe('2.10.0')
  })

  it('returns nothing when the running version is not plain x.y.z', () => {
    expect(newerRelease(list, 'ray-v', '2.0.0-dev')).toBeNull()
  })
})

describe('response shape', () => {
  it('rejects a response that is not a release list', () => {
    expect(ReleaseListSchema.safeParse({ message: 'API rate limit exceeded' }).success).toBe(false)
    expect(ReleaseListSchema.safeParse([{ tag_name: 1, draft: false, prerelease: false }]).success).toBe(false)
  })
})

describe('releasePageUrl', () => {
  it('builds the page from a validated tag, never from the response', () => {
    expect(releasePageUrl('ray-v2.1.0', 'ray-v')).toBe('https://github.com/ugurshelby/prism/releases/tag/ray-v2.1.0')
    expect(releasePageUrl('spectrum-v3.1.0', 'ray-v')).toBeNull()
    expect(releasePageUrl('ray-v2.1.0/../../x', 'ray-v')).toBeNull()
  })
})

describe('checkDue and parseVersion', () => {
  it('checks at most once a day unless the clock went back', () => {
    expect(checkDue(null, 1000)).toBe(true)
    expect(checkDue(1000, 1000 + CHECK_INTERVAL_MS - 1)).toBe(false)
    expect(checkDue(1000, 1000 + CHECK_INTERVAL_MS)).toBe(true)
    expect(checkDue(5000, 1000)).toBe(true)
  })

  it('accepts only plain versions', () => {
    expect(parseVersion('2.0.0')).toEqual([2, 0, 0])
    expect(parseVersion(' 2.0.0')).toBeNull()
    expect(parseVersion('2.0')).toBeNull()
  })
})

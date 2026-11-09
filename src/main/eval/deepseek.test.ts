import { describe, expect, it } from 'vitest'
import { assertProviderUrl } from '../llm/http'
import { combineVotes, type Vote } from './votes'
import { deepseekUrl } from './deepseek'

describe('DeepSeek jüri uç noktası', () => {
  it('izin listesindeki Vertex sunucusuna gider ve proje yolunu kodlar', () => {
    const url = deepseekUrl({ key: 'x', project: 'prism-engine-514117' })
    expect(assertProviderUrl(url).hostname).toBe('aiplatform.googleapis.com')
    expect(url).toContain('/projects/prism-engine-514117/locations/global/endpoints/openapi/chat/completions')
    expect(deepseekUrl({ key: 'x', project: '../evil' })).toContain('/projects/..%2Fevil/')
  })

  it('proje yoksa açık hata verir', () => {
    expect(() => deepseekUrl({ key: 'x' })).toThrow()
  })
})

const v = (juror: Vote['juror'], prismFirst: boolean, winner: 'A' | 'B' | 'tie', a = 7, b = 5): Vote => ({ juror, prismFirst, verdict: { winner, score_a: a, score_b: b, reason: '' } })

describe('combineVotes', () => {
  it('tek jüride iki sıra da Prism derse kazanç, ayrışırsa beraberlik', () => {
    expect(combineVotes([v('gemini', true, 'A'), v('gemini', false, 'B')]).outcome).toBe('win')
    expect(combineVotes([v('gemini', true, 'A'), v('gemini', false, 'A')]).outcome).toBe('tie')
    expect(combineVotes([v('gemini', true, 'B'), v('gemini', false, 'A')]).outcome).toBe('loss')
  })

  it('iki jüride 3-1 kazanç, 2-2 beraberlik; puan farkı Prism tarafından', () => {
    const r = combineVotes([v('gemini', true, 'A'), v('gemini', false, 'B', 5, 7), v('deepseek', true, 'A'), v('deepseek', false, 'A', 7, 5)])
    expect(r.outcome).toBe('win')
    expect(combineVotes([v('gemini', true, 'A'), v('gemini', false, 'A'), v('deepseek', true, 'A'), v('deepseek', false, 'A')]).outcome).toBe('tie')
    expect(combineVotes([v('gemini', true, 'A', 8, 6), v('gemini', false, 'B', 6, 8)]).scoreDelta).toBe(2)
  })
})

import { describe, expect, it } from 'vitest'
import { allRaces } from './data'
import { buildMailto } from './corrections'

const decode = (mailto: string) => {
  const q = new URL(mailto).searchParams
  return { subject: q.get('subject') ?? '', body: q.get('body') ?? '' }
}

describe('corrections mailto', () => {
  it('uses the same subject and body template for every state', () => {
    const asOf = '2026-10-31T12:00:00Z'
    const names = allRaces.races.map((r) => r.raceName.replace(/ Senate( special election)? 2026$/, ''))
    for (const name of names) {
      const { subject, body } = decode(buildMailto(name, `https://x.test/#${name}`, asOf, 'a@b.test'))
      expect(subject).toBe(`Money & Margins correction: ${name}`)
      expect(body.replace(`https://x.test/#${name}`, '[link]')).toBe(
        'What looks wrong:\n\nWhere you saw it: [link]\nData as of: 2026-10-31T12:00:00Z\nSource link (optional):\n',
      )
    }
    expect(decode(buildMailto(null, 'https://x.test/', asOf, 'a@b.test')).subject).toBe('Money & Margins correction')
  })
})

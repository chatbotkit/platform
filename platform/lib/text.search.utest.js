import { matchSearchText, tokenizeSearchQuery } from './text.search'

describe('text.search', () => {
  it('normalizes and deduplicates query tokens', () => {
    expect(tokenizeSearchQuery('Calendar, calendar OAuth')).toEqual([
      'calendar',
      'oauth',
    ])
  })

  it('weights fields and returns the strongest matching excerpt', () => {
    const result = matchSearchText('calendar oauth', [
      { value: 'Google Calendar', weight: 12, excerpt: true },
      { value: ['calendar', 'oauth'], weight: 8 },
      {
        value: 'OAuth access for calendar events and scheduling.',
        weight: 6,
        excerpt: true,
      },
    ])

    expect(result).toMatchObject({
      score: expect.any(Number),
      excerpt: 'Google Calendar',
    })
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThanOrEqual(1)
  })

  it.each(['', 'missing'])('returns no match when appropriate', (query) => {
    expect(
      matchSearchText(query, [{ value: 'calendar', weight: 1 }])
    ).toBeNull()
  })
})

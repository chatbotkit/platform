import { searchExamples } from './example.search'

jest.mock('@/examples', () => ({
  __esModule: true,
  default: [
    {
      slug: 'calendar-support',
      title: 'Calendar Support Bot',
      description: 'Helps teams schedule meetings and answer questions.',
      keywords: ['calendar', 'support'],
      commentary: 'Uses a calendar integration.',
    },
    {
      slug: 'web-research',
      title: 'Web Research Assistant',
      description: 'Searches the web and summarizes sources.',
      keywords: ['research', 'web'],
      commentary: 'Useful for fact finding.',
    },
    {
      slug: 'customer-support',
      title: 'Customer Support',
      description: 'Answers product questions.',
      keywords: ['support'],
    },
  ],
}))

describe('searchExamples', () => {
  it.each(['', '   '])(
    'returns no results for an empty query',
    async (query) => {
      await expect(searchExamples(query)).resolves.toEqual([])
    }
  )

  it('returns matching examples ordered by weighted text relevance', async () => {
    const results = await searchExamples('calendar support')

    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({
      slug: 'calendar-support',
      score: expect.any(Number),
      snippet: 'Calendar Support Bot',
    })
    expect(results[0].score).toBeGreaterThan(results[1].score)
  })

  it('respects limit and threshold options', async () => {
    await expect(searchExamples('support', { limit: 1 })).resolves.toHaveLength(
      1
    )
    await expect(
      searchExamples('calendar', { threshold: 0.9 })
    ).resolves.toEqual([])
  })

  it('does not return examples without a matching term', async () => {
    await expect(searchExamples('nonexistent-term')).resolves.toEqual([])
  })
})

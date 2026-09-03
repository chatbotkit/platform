import template from '@/templates/widget'

const fetchMock = jest.fn()

function mockCreates(...ids) {
  for (const id of ids) {
    fetchMock.mockResolvedValueOnce({ error: null, data: { id } })
  }
}

function calledUrls() {
  return fetchMock.mock.calls.map(([url]) => url)
}

describe('widget template', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('always creates a skillset and attaches it to the bot', async () => {
    mockCreates('blueprint-1', 'skillset-1', 'bot-1', 'widget-1')

    const result = await template.task({
      values: { name: 'Helper', description: 'A helper' },
      fetch: fetchMock,
    })

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/skillset/create',
      expect.objectContaining({
        data: expect.objectContaining({
          blueprintId: 'blueprint-1',

          name: 'Helper',
          description: 'A helper',
        }),
      })
    )

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/bot/create',
      expect.objectContaining({
        data: expect.objectContaining({
          blueprintId: 'blueprint-1',

          skillsetId: 'skillset-1',
        }),
      })
    )

    expect(result.createdBlueprintId).toBe('blueprint-1')
    expect(result.successButtonAction).toBe('/integrations/widget/widget-1')
  })

  it('leaves the dataset out when no website url was given', async () => {
    mockCreates('blueprint-1', 'skillset-1', 'bot-1', 'widget-1')

    await template.task({
      values: { name: 'Helper', description: 'A helper' },
      fetch: fetchMock,
    })

    expect(calledUrls()).not.toContain('/api/v1/dataset/create')

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/bot/create',
      expect.objectContaining({
        data: expect.objectContaining({ datasetId: undefined }),
      })
    )
  })

  it('creates and syncs a dataset when a website url was given', async () => {
    mockCreates('blueprint-1', 'skillset-1', 'dataset-1', 'sitemap-1')

    // sync returns no resource of its own
    fetchMock.mockResolvedValueOnce({ error: null, data: {} })

    mockCreates('bot-1', 'widget-1')

    await template.task({
      values: {
        name: 'Helper',
        description: 'A helper',
        websiteURL: 'https://example.com',
      },
      fetch: fetchMock,
    })

    expect(calledUrls()).toEqual([
      '/api/v1/blueprint/create',
      '/api/v1/skillset/create',
      '/api/v1/dataset/create',
      '/api/v1/integration/sitemap/create',
      '/api/v1/integration/sitemap/sitemap-1/sync',
      '/api/v1/bot/create',
      '/api/v1/integration/widget/create',
    ])

    // the bot is wired to both the knowledge base and the skillset
    expect(fetchMock).toHaveBeenNthCalledWith(
      6,
      '/api/v1/bot/create',
      expect.objectContaining({
        data: expect.objectContaining({
          datasetId: 'dataset-1',
          skillsetId: 'skillset-1',
        }),
      })
    )
  })
})

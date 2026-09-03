import { googlechat, slack, telegram, whatsapp } from '@/templates/channels'

const fetchMock = jest.fn()

describe('channel templates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each([
    { template: slack, integration: 'slack' },
    { template: telegram, integration: 'telegram' },
    { template: whatsapp, integration: 'whatsapp' },
    { template: googlechat, integration: 'googlechat' },
  ])(
    'gives the $integration agent a skillset and attaches it to the bot',
    async ({ template, integration }) => {
      fetchMock.mockResolvedValueOnce({
        error: null,
        data: { id: 'blueprint-1' },
      })
      fetchMock.mockResolvedValueOnce({
        error: null,
        data: { id: 'skillset-1' },
      })
      fetchMock.mockResolvedValueOnce({ error: null, data: { id: 'bot-1' } })
      fetchMock.mockResolvedValueOnce({
        error: null,
        data: { id: 'integration-1' },
      })

      const result = await template.task({
        values: {
          ...template.values,

          name: 'Helper',
          description: 'A helper',
        },
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

      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        `/api/v1/integration/${integration}/create`,
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'blueprint-1',

            botId: 'bot-1',

            contactCollection: true,
            attachments: true,
          }),
        })
      )

      expect(result.createdBlueprintId).toBe('blueprint-1')
      expect(result.createdBlueprintName).toBe('Helper')
    }
  )

  it('never reaches the bot when the skillset cannot be created', async () => {
    fetchMock.mockResolvedValueOnce({
      error: null,
      data: { id: 'blueprint-1' },
    })
    fetchMock.mockResolvedValueOnce({ error: 'nope', data: null })

    await expect(
      slack.task({
        values: { ...slack.values, name: 'Helper' },
        fetch: fetchMock,
      })
    ).rejects.toThrow('nope')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

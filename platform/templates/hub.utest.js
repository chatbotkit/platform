import template from '@/templates/hub'

const fetchMock = jest.fn()

// @note every hub clone is wrapped in a fresh project named after the resource,
// so the blueprint create is always the first call
function mockBlueprintCreate(id = 'blueprint-1') {
  fetchMock.mockResolvedValueOnce({ error: null, data: { id } })
}

describe('hub template', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws when no instance is selected', async () => {
    await expect(
      template.task({ options: {}, fetch: fetchMock })
    ).rejects.toThrow('No instance selected')
  })

  it('throws on an unknown instance type', async () => {
    await expect(
      template.task({
        options: { instance: { type: 'contact', ref: {} } },
        fetch: fetchMock,
      })
    ).rejects.toThrow('Unknown type contact')
  })

  it.each([
    ['bot', { name: 'Helper', description: 'A helper', backstory: 'hi' }],
    ['widget', { name: 'Helper', description: 'A helper', theme: 'default' }],
    ['dataset', { name: 'Helper', description: 'A helper' }],
    ['skillset', { name: 'Helper', description: 'A helper' }],
  ])(
    'wraps a cloned %s in a project carrying its name and description',
    async (type, ref) => {
      mockBlueprintCreate()
      fetchMock.mockResolvedValue({ error: null, data: { id: 'resource-1' } })

      const result = await template.task({
        options: { instance: { type, ref } },
        fetch: fetchMock,
      })

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        '/api/v1/blueprint/create',
        expect.objectContaining({
          data: { name: 'Helper', description: 'A helper' },
        })
      )

      expect(result.createdBlueprintId).toBe('blueprint-1')
      expect(result.createdBlueprintName).toBe('Helper')
    }
  )

  it.each(['bot', 'widget', 'dataset', 'skillset'])(
    'stops when the project for a cloned %s cannot be created',
    async (type) => {
      fetchMock.mockResolvedValueOnce({ error: 'nope', data: null })

      const result = await template.task({
        options: { instance: { type, ref: { name: 'Helper' } } },
        fetch: fetchMock,
      })

      expect(result).toBeUndefined()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    }
  )

  describe('bot instances', () => {
    it('assigns the bot to the project and lands on it when there is no widget', async () => {
      mockBlueprintCreate()
      fetchMock.mockResolvedValueOnce({ error: null, data: { id: 'bot-1' } })

      const result = await template.task({
        options: {
          instance: { type: 'bot', ref: { name: 'Helper', backstory: 'hi' } },
        },
        fetch: fetchMock,
      })

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/v1/bot/create',
        expect.objectContaining({
          data: { blueprintId: 'blueprint-1', name: 'Helper', backstory: 'hi' },
        })
      )

      expect(result.successButtonAction).toBe('/bots/bot-1')
      expect(result.successButtonCaption).toBe('Go to bot')
    })

    it('assigns both the bot and its widget to the project', async () => {
      mockBlueprintCreate()
      fetchMock
        .mockResolvedValueOnce({ error: null, data: { id: 'bot-1' } })
        .mockResolvedValueOnce({ error: null, data: { id: 'widget-1' } })

      const result = await template.task({
        options: {
          instance: {
            type: 'bot',
            ref: { name: 'Helper', widget: { theme: 'default' } },
          },
        },
        fetch: fetchMock,
      })

      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/v1/integration/widget/create',
        expect.objectContaining({
          data: {
            blueprintId: 'blueprint-1',
            botId: 'bot-1',
            theme: 'default',
          },
        })
      )

      expect(result.successButtonAction).toBe('/integrations/widget/widget-1')
      expect(result.successButtonCaption).toBe('Go to widget')
    })

    it('stops when the bot cannot be created', async () => {
      mockBlueprintCreate()
      fetchMock.mockResolvedValueOnce({ error: 'nope', data: null })

      const result = await template.task({
        options: { instance: { type: 'bot', ref: { name: 'Helper' } } },
        fetch: fetchMock,
      })

      expect(result).toBeUndefined()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('widget instances', () => {
    it('assigns the widget to the project and lands on the integration', async () => {
      mockBlueprintCreate()
      fetchMock.mockResolvedValueOnce({ error: null, data: { id: 'widget-1' } })

      const result = await template.task({
        options: {
          instance: {
            type: 'widget',
            ref: { name: 'Docs Widget', theme: 'default' },
          },
        },
        fetch: fetchMock,
      })

      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/v1/integration/widget/create',
        expect.objectContaining({
          data: {
            blueprintId: 'blueprint-1',
            name: 'Docs Widget',
            theme: 'default',
          },
        })
      )

      expect(result.successButtonAction).toBe('/integrations/widget/widget-1')
      expect(result.successButtonCaption).toBe('Go to widget')
    })
  })

  describe('dataset instances', () => {
    it('assigns the dataset to the project and lands on it', async () => {
      mockBlueprintCreate()
      fetchMock.mockResolvedValueOnce({
        error: null,
        data: { id: 'dataset-1' },
      })

      const result = await template.task({
        options: { instance: { type: 'dataset', ref: { name: 'Docs' } } },
        fetch: fetchMock,
      })

      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/v1/dataset/create',
        expect.objectContaining({
          data: { blueprintId: 'blueprint-1', name: 'Docs' },
        })
      )

      expect(result.successButtonAction).toBe('/datasets/dataset-1')
      expect(result.successButtonCaption).toBe('Go to dataset')
    })
  })

  describe('skillset instances', () => {
    // @note the hub page used to read the abilities off the wrong object, so
    // the clone created an empty skillset and then threw - the step now hands
    // the abilities over explicitly
    it('assigns the skillset to the project and clones every ability', async () => {
      mockBlueprintCreate()
      fetchMock
        .mockResolvedValueOnce({ error: null, data: { id: 'skillset-1' } })
        .mockResolvedValueOnce({ error: null, data: { id: 'ability-1' } })
        .mockResolvedValueOnce({ error: null, data: { id: 'ability-2' } })

      const result = await template.task({
        options: {
          instance: {
            type: 'skillset',
            ref: {
              name: 'Support',
              description: 'Support skills',
              abilities: [
                { name: 'lookup', description: 'd1', instruction: 'i1' },
                { name: 'refund', description: 'd2', instruction: 'i2' },
              ],
            },
          },
        },
        fetch: fetchMock,
      })

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/v1/skillset/create',
        expect.objectContaining({
          data: {
            blueprintId: 'blueprint-1',
            name: 'Support',
            description: 'Support skills',
          },
        })
      )

      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/v1/skillset/skillset-1/ability/create',
        expect.objectContaining({
          data: { name: 'refund', description: 'd2', instruction: 'i2' },
        })
      )

      expect(fetchMock).toHaveBeenCalledTimes(4)

      expect(result.successButtonAction).toBe('/skillsets/skillset-1')
      expect(result.successButtonCaption).toBe('Go to skillset')
    })

    it('clones a skillset that has no abilities', async () => {
      mockBlueprintCreate()
      fetchMock.mockResolvedValueOnce({
        error: null,
        data: { id: 'skillset-1' },
      })

      const result = await template.task({
        options: { instance: { type: 'skillset', ref: { name: 'Empty' } } },
        fetch: fetchMock,
      })

      expect(fetchMock).toHaveBeenCalledTimes(2)

      expect(result.successButtonAction).toBe('/skillsets/skillset-1')
    })

    it('stops when an ability cannot be created', async () => {
      mockBlueprintCreate()
      fetchMock
        .mockResolvedValueOnce({ error: null, data: { id: 'skillset-1' } })
        .mockResolvedValueOnce({ error: 'nope', data: null })

      const result = await template.task({
        options: {
          instance: {
            type: 'skillset',
            ref: {
              name: 'Support',
              abilities: [{ name: 'lookup' }, { name: 'refund' }],
            },
          },
        },
        fetch: fetchMock,
      })

      expect(result).toBeUndefined()
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })
  })

  describe('blueprint instances', () => {
    const blueprintInstance = {
      type: 'blueprint',
      ref: { id: 'blueprint-1', name: 'Support Desk' },
    }

    // @note a blueprint clone already produces a project of its own, so it does
    // not get wrapped in another one
    it('clones the blueprint and lands on the designer', async () => {
      fetchMock.mockResolvedValueOnce({
        error: null,
        data: { id: 'blueprint-2' },
      })

      const result = await template.task({
        options: { instance: blueprintInstance },
        fetch: fetchMock,
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/blueprint/blueprint-1/clone',
        expect.objectContaining({ method: 'POST' })
      )

      expect(result.successButtonAction).toBe(
        '/blueprints/blueprint-2/designer'
      )
      expect(result.successButtonCaption).toBe('Continue to your blueprint')
    })

    // @note pages/new/success.jsx reads this to send the builder experience to
    // the project-scoped overview instead of the designer
    it('reports the clone as the created project', async () => {
      fetchMock.mockResolvedValueOnce({
        error: null,
        data: { id: 'blueprint-2' },
      })

      const result = await template.task({
        options: { instance: blueprintInstance },
        fetch: fetchMock,
      })

      expect(result.createdBlueprintId).toBe('blueprint-2')
      expect(result.createdBlueprintName).toBe('Support Desk')
    })

    it('stops when the clone fails', async () => {
      fetchMock.mockResolvedValueOnce({ error: 'nope', data: null })

      const result = await template.task({
        options: { instance: blueprintInstance },
        fetch: fetchMock,
      })

      expect(result).toBeUndefined()
    })
  })
})

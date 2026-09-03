import template from '@/templates/example'

const fetchMock = jest.fn()

// clone responses: widget examples come back wrapped in a blueprint (with the
// widget assigned to it), and blueprint examples may create widget nodes too -
// the routing must tell the two apart by the example format, not the resources
const widgetCloneData = {
  resources: {
    blueprint: [{ id: 'blueprint-1', name: 'Widget Example' }],
    bot: [{ id: 'bot-1' }],
    widgetIntegration: [{ id: 'widget-1' }],
  },
}

const widgetExample = {
  slug: 'widget-example',
  title: 'Widget Example',
  theme: 'default',
}

const blueprintExample = {
  slug: 'blueprint-example',
  title: 'Blueprint Example',
  blueprint: { resources: {} },
}

describe('example template', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    fetchMock.mockResolvedValue({ error: null, data: widgetCloneData })
  })

  it('throws when no example is selected', async () => {
    await expect(
      template.task({ options: {}, fetch: fetchMock })
    ).rejects.toThrow('No example selected')
  })

  it('lands widget examples on the widget integration page', async () => {
    const result = await template.task({
      options: { example: widgetExample },
      fetch: fetchMock,
    })

    expect(result.successButtonAction).toBe('/integrations/widget/widget-1')
    expect(result.successButtonCaption).toBe('Continue to your widget')
  })

  it('lands blueprint examples on the designer', async () => {
    const result = await template.task({
      options: { example: blueprintExample },
      fetch: fetchMock,
    })

    expect(result.successButtonAction).toBe('/blueprints/blueprint-1/designer')
    expect(result.successButtonCaption).toBe('Continue to your blueprint')
  })

  // @note the builder experience redirect is applied by pages/new/success.jsx,
  // which needs the cloned blueprint id to know which project to scope to
  it('reports the cloned blueprint as the created project', async () => {
    const result = await template.task({
      options: { example: blueprintExample },
      fetch: fetchMock,
    })

    expect(result.createdBlueprintId).toBe('blueprint-1')
    expect(result.createdBlueprintName).toBe('Widget Example')
  })
})

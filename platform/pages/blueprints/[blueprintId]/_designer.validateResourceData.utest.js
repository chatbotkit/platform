import { integrationResources, validateResourceData } from './designer'

jest.mock('@/prisma/client', () => ({}))
jest.mock('@/lib/toast', () => ({ success: jest.fn(), error: jest.fn() }))
jest.mock('@chatbotkit/react/hooks/useWidgetInstanceFunctions', () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock('@xyflow/react', () => ({
  Background: jest.fn(),
  BaseEdge: jest.fn(),
  ConnectionLineType: {},
  ControlButton: jest.fn(),
  Controls: jest.fn(),
  EdgeLabelRenderer: jest.fn(),
  Handle: jest.fn(),
  MiniMap: jest.fn(),
  NodeResizer: jest.fn(),
  Position: {},
  ReactFlow: jest.fn(),
  ReactFlowProvider: jest.fn(),
  addEdge: jest.fn(),
  getSmoothStepPath: jest.fn(),
  useConnection: jest.fn(),
  useEdgesState: jest.fn(() => [[], jest.fn(), jest.fn()]),
  useNodeConnections: jest.fn(),
  useNodesInitialized: jest.fn(() => false),
  useNodesState: jest.fn(() => [[], jest.fn(), jest.fn()]),
  useOnSelectionChange: jest.fn(),
  useReactFlow: jest.fn(() => ({
    getNodes: jest.fn(() => []),
    getEdges: jest.fn(() => []),
    getNode: jest.fn(),
    setNodes: jest.fn(),
    setEdges: jest.fn(),
    addNodes: jest.fn(),
    addEdges: jest.fn(),
    fitView: jest.fn(),
    screenToFlowPosition: jest.fn(),
    updateNode: jest.fn(),
  })),
  useUpdateNodeInternals: jest.fn(),
}))
jest.mock('@dagrejs/dagre', () => ({
  graphlib: {
    Graph: jest.fn(() => ({
      setDefaultEdgeLabel: jest.fn().mockReturnThis(),
      setGraph: jest.fn(),
      setNode: jest.fn(),
      setEdge: jest.fn(),
      node: jest.fn(() => ({ x: 0, y: 0 })),
    })),
  },
  layout: jest.fn(),
}))

describe('validateResourceData', () => {
  it('returns valid for an empty object on a known type', () => {
    const result = validateResourceData('bot', {})

    expect(result.valid).toBe(true)
  })

  it('returns valid for correct field types', () => {
    const result = validateResourceData('bot', { name: 'My Bot' })

    expect(result.valid).toBe(true)
  })

  it('returns invalid for wrong field types', () => {
    const result = validateResourceData('bot', { name: 123 })

    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('name')
  })

  it('returns valid for unknown resource types', () => {
    const result = validateResourceData('unknownType', { anything: true })

    expect(result.valid).toBe(true)
  })

  it('returns invalid for wrong types on abilities', () => {
    const result = validateResourceData('ability', { name: [] })

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('returns valid for correct ability data', () => {
    const result = validateResourceData('ability', {
      name: 'Search',
      description: 'Search the web',
      instruction: '@platform/web-search',
    })

    expect(result.valid).toBe(true)
  })

  it('rejects an unknown ability key with the standard strict-parse message', () => {
    const result = validateResourceData('ability', {
      name: 'Search',
      description: 'Search the web',
      instruction: '@platform/web-search',
      secretId: 'secret-1',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      "ability: Unrecognized key(s) in object: 'secretId'",
    ])
  })

  it.each([
    ['linkedSecretId', 'secret-1'],
    ['linkedFileId', 'file-1'],
    ['linkedBotId', 'bot-1'],
    ['linkedSpaceId', 'space-1'],
  ])('accepts ability data using the linked key `%s`', (linkedKey, value) => {
    const result = validateResourceData('ability', {
      name: 'Search',
      description: 'Search the web',
      instruction: '@platform/web-search',
      [linkedKey]: value,
    })

    expect(result.valid).toBe(true)
  })

  it('returns valid for ability data using all four linked keys', () => {
    const result = validateResourceData('ability', {
      name: 'Search',
      description: 'Search the web',
      instruction: '@platform/web-search',
      linkedSecretId: 'secret-1',
      linkedFileId: 'file-1',
      linkedBotId: 'bot-1',
      linkedSpaceId: 'space-1',
    })

    expect(result.valid).toBe(true)
  })

  it('returns invalid for wrong types on secrets', () => {
    const result = validateResourceData('secret', { name: 42 })

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('validates integration types', () => {
    const result = validateResourceData('slackIntegration', { botToken: 123 })

    expect(result.valid).toBe(false)
  })

  it('returns valid for correct integration data', () => {
    const result = validateResourceData('slackIntegration', {
      botToken: 'xoxb-123',
    })

    expect(result.valid).toBe(true)
  })

  it('uses an automatic session duration for new widget nodes', () => {
    expect(
      integrationResources.widgetIntegration.data.sessionDuration
    ).toBeNull()
  })

  it('exposes the widget session duration maximum to the designer', () => {
    expect(
      integrationResources.widgetIntegration.schema.sessionDuration.maximum
    ).toBe(3600000)
  })

  it.each([null, 0, 3600000])(
    'accepts supported widget session duration %s',
    (sessionDuration) => {
      expect(
        validateResourceData('widgetIntegration', { sessionDuration }).valid
      ).toBe(true)
    }
  )

  it.each([3600001, 86400000])(
    'rejects unsupported widget session duration %s',
    (sessionDuration) => {
      expect(
        validateResourceData('widgetIntegration', { sessionDuration }).valid
      ).toBe(false)
    }
  )

  it('returns invalid for a dataset with an unknown field like spaceId', () => {
    const result = validateResourceData('dataset', {
      name: 'My Dataset',
      description: 'A dataset',
      spaceId: 'space-123',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toBeDefined()
    expect(result.errors.some((e) => e.includes('spaceId'))).toBe(true)
  })
})

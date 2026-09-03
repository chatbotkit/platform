import { getSecretWarnings } from './designer'

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

describe('getSecretWarnings', () => {
  it('warns when name is missing', () => {
    const warnings = getSecretWarnings({ type: 'token', config: {} })

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('name'),
          type: 'suggestion',
        }),
      ])
    )
  })

  it('returns no warnings for a named non-template secret', () => {
    const warnings = getSecretWarnings({
      name: 'my-secret',
      type: 'token',
      config: {},
    })

    expect(warnings).toEqual([])
  })

  it('warns when template does not exist in secretResources', () => {
    const secretResources = {
      'platform/existing-secret': { title: 'Existing' },
    }

    const warnings = getSecretWarnings(
      {
        name: 'my-secret',
        type: 'template',
        config: { template: 'platform/non-existent-secret' },
      },
      secretResources
    )

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('does not exist'),
          type: 'warning',
        }),
      ])
    )
  })

  it('does not warn when template exists in secretResources', () => {
    const secretResources = {
      'platform/existing-secret': { title: 'Existing' },
    }

    const warnings = getSecretWarnings(
      {
        name: 'my-secret',
        type: 'template',
        config: { template: 'platform/existing-secret' },
      },
      secretResources
    )

    expect(warnings).toEqual([])
  })

  it('does not check template when secretResources is not provided', () => {
    const warnings = getSecretWarnings({
      name: 'my-secret',
      type: 'template',
      config: { template: 'platform/non-existent-secret' },
    })

    expect(warnings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('does not exist'),
        }),
      ])
    )
  })

  it('does not check template for non-template type secrets', () => {
    const secretResources = {
      'platform/existing-secret': { title: 'Existing' },
    }

    const warnings = getSecretWarnings(
      {
        name: 'my-secret',
        type: 'oauth',
        config: { template: 'platform/non-existent-secret' },
      },
      secretResources
    )

    expect(warnings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('does not exist'),
        }),
      ])
    )
  })

  it('warns when template type secret has empty template config', () => {
    const secretResources = {
      'platform/existing-secret': { title: 'Existing' },
    }

    const warnings = getSecretWarnings(
      {
        name: 'my-secret',
        type: 'template',
        config: {},
      },
      secretResources
    )

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('no template assigned'),
          type: 'warning',
        }),
      ])
    )
  })

  it('warns when template type secret has empty string template', () => {
    const warnings = getSecretWarnings({
      name: 'my-secret',
      type: 'template',
      config: { template: '' },
    })

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('no template assigned'),
          type: 'warning',
        }),
      ])
    )
  })

  it('warns when connections is an empty array', () => {
    const warnings = getSecretWarnings(
      { name: 'my-secret', type: 'token', config: {} },
      undefined,
      { connections: [] }
    )

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('ability'),
          type: 'warning',
        }),
      ])
    )
  })

  it('does not warn when connections has entries', () => {
    const warnings = getSecretWarnings(
      { name: 'my-secret', type: 'token', config: {} },
      undefined,
      { connections: [{ source: '#ability-1' }] }
    )

    expect(warnings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('ability'),
        }),
      ])
    )
  })

  it('does not warn about connections when connections is not provided', () => {
    const warnings = getSecretWarnings({
      name: 'my-secret',
      type: 'token',
      config: {},
    })

    expect(warnings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('ability'),
        }),
      ])
    )
  })
})

import { getDatasetWarnings } from './designer'

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

describe('getDatasetWarnings', () => {
  it('warns when name is missing', () => {
    const warnings = getDatasetWarnings({ description: 'test' })

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('name'),
          type: 'suggestion',
        }),
      ])
    )
  })

  it('warns when description is missing', () => {
    const warnings = getDatasetWarnings({ name: 'test' })

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('description'),
          type: 'suggestion',
        }),
      ])
    )
  })

  it('returns no warnings when name and description are provided', () => {
    const warnings = getDatasetWarnings({ name: 'test', description: 'test' })

    expect(warnings).toHaveLength(0)
  })

  it('does not warn about unknown fields - schema validation is handled separately', () => {
    // getDatasetWarnings only checks semantic completeness (name, description).
    // Unknown field validation (e.g. spaceId on a dataset) is the responsibility
    // of validateResourceData which uses the blueprintSchema with strict mode.
    const warnings = getDatasetWarnings({
      name: 'My Dataset',
      description: 'A dataset',
      spaceId: 'space-123',
    })

    expect(warnings).toHaveLength(0)
  })
})

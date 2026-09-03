import {
  getToolbarFacetDefinitions,
  getToolbarFacetEntriesForActiveTab,
} from './designer'

jest.mock('@/prisma/client', () => ({}))
jest.mock('@/lib/env', () => ({
  isDevelopment: false,
  isProduction: true,
}))
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

describe('toolbar facet helpers in production', () => {
  it('hides alpha filters across ability-template tabs', () => {
    for (const activeTab of ['abilities', 'packs', 'mcps', 'mocks']) {
      expect(
        getToolbarFacetDefinitions(activeTab, [{ type: 'entry', tags: [] }])
      ).toEqual([
        { label: 'Stable', value: 'stable' },
        { label: 'Beta', value: 'beta' },
        { label: 'All', value: 'all' },
      ])
    }
  })

  it('hides alpha filter for secrets in production', () => {
    expect(
      getToolbarFacetDefinitions('secrets', [
        { type: 'platform/openai', tags: [] },
      ])
    ).toEqual([
      { label: 'Platform', value: 'platform' },
      { label: 'Beta', value: 'beta' },
      { label: 'All', value: 'all' },
    ])
  })

  it('filters alpha-tagged ability templates and secrets out of production entries', () => {
    expect(
      getToolbarFacetEntriesForActiveTab({
        activeTab: 'mcps',
        abilityResources: {
          'mcp/stable': { tags: [] },
          'mcp/alpha': { tags: ['alpha'] },
        },
      }).map((entry) => entry.type)
    ).toEqual(['mcp/stable'])

    expect(
      getToolbarFacetEntriesForActiveTab({
        activeTab: 'secrets',
        secretResources: {
          'platform/openai': { tags: [] },
          'external/alpha': { tags: ['alpha'] },
        },
      }).map((entry) => entry.type)
    ).toEqual(['platform/openai'])
  })
})

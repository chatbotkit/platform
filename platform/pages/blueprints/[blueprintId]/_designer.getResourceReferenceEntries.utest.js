import { getResourceReferenceEntries } from './designer'

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

describe('getResourceReferenceEntries', () => {
  it.each([
    ['linkedSecretId', 'secret-1', 'secret'],
    ['linkedFileId', 'file-1', 'file'],
    ['linkedBotId', 'bot-1', 'bot'],
    ['linkedSpaceId', 'space-1', 'space'],
    ['datasetId', 'dataset-1', 'dataset'],
  ])('maps %s to a %s -> %s entry', (key, value, targetHandle) => {
    expect(getResourceReferenceEntries({ [key]: value })).toEqual([
      { key, value, sourceHandle: key, targetHandle },
    ])
  })

  it('skips non-*Id keys and empty reference values', () => {
    expect(
      getResourceReferenceEntries({
        name: 'Lookup',
        description: 'x',
        linkedSecretId: null,
        linkedFileId: undefined,
        linkedBotId: '',
        linkedSpaceId: 'space-1',
        datasetId: 42,
      })
    ).toEqual([
      {
        key: 'linkedSpaceId',
        value: 'space-1',
        sourceHandle: 'linkedSpaceId',
        targetHandle: 'space',
      },
    ])
  })

  it('returns no entries for empty data', () => {
    expect(getResourceReferenceEntries()).toEqual([])
    expect(getResourceReferenceEntries({})).toEqual([])
  })
})

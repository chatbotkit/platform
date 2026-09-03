import { getNoteSurfaceClasses } from './designer'

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

describe('getNoteSurfaceClasses', () => {
  it('returns solid yellow surfaces by default', () => {
    const surfaceClasses = getNoteSurfaceClasses()

    expect(surfaceClasses.frame).toContain('bg-yellow-400')
    expect(surfaceClasses.body).toContain('bg-yellow-50')
    expect(surfaceClasses.header).toContain('bg-yellow-100')
  })

  it('returns solid classes for explicit note colors', () => {
    const surfaceClasses = getNoteSurfaceClasses('red')

    expect(surfaceClasses.frame).toContain('bg-red-400')
    expect(surfaceClasses.body).toContain('bg-red-50')
    expect(surfaceClasses.header).toContain('bg-red-100')
  })

  it('falls back to yellow for unknown colors', () => {
    const surfaceClasses = getNoteSurfaceClasses('unknown')

    expect(surfaceClasses.frame).toContain('bg-yellow-400')
    expect(surfaceClasses.body).toContain('bg-yellow-50')
    expect(surfaceClasses.header).toContain('bg-yellow-100')
  })
})

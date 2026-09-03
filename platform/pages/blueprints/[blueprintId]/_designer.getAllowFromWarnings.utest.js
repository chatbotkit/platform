import { allowFromHasWildcard, getAllowFromWarnings } from './designer'

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

describe('allowFromHasWildcard', () => {
  it('detects a bare wildcard', () => {
    expect(allowFromHasWildcard('*')).toBe(true)
  })

  it('detects a wildcard surrounded by whitespace', () => {
    expect(allowFromHasWildcard('  *  ')).toBe(true)
  })

  it('detects a wildcard among other entries (comma and newline separated)', () => {
    expect(allowFromHasWildcard('@U12345678, *')).toBe(true)
    expect(allowFromHasWildcard('#C12345678\n*')).toBe(true)
  })

  it('does not treat partial matches as wildcards', () => {
    expect(allowFromHasWildcard('*abc')).toBe(false)
    expect(allowFromHasWildcard('**')).toBe(false)
    expect(allowFromHasWildcard('@user*')).toBe(false)
  })

  it('returns false for a specific allow list', () => {
    expect(allowFromHasWildcard('@U12345678, #C12345678')).toBe(false)
  })

  it('returns false for empty, missing or non-string values', () => {
    expect(allowFromHasWildcard('')).toBe(false)
    expect(allowFromHasWildcard(undefined)).toBe(false)
    expect(allowFromHasWildcard(null)).toBe(false)
    expect(allowFromHasWildcard(42)).toBe(false)
  })
})

describe('getAllowFromWarnings', () => {
  it('surfaces a non-scary suggestion when allowFrom is a wildcard', () => {
    const warnings = getAllowFromWarnings({ allowFrom: '*' })

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('allowFrom'),
          // @note a wildcard is acceptable for public bots, so this is a soft
          // suggestion (yellow) rather than an alarming warning (red)
          type: 'suggestion',
        }),
      ])
    )
  })

  it('warns when the wildcard appears alongside specific entries', () => {
    const warnings = getAllowFromWarnings({ allowFrom: '@U12345678\n*' })

    expect(warnings).toHaveLength(1)
    expect(warnings[0].type).toBe('suggestion')
  })

  it('returns no warnings when allowFrom restricts to specific senders', () => {
    const warnings = getAllowFromWarnings({
      allowFrom: '@U12345678, #C12345678',
    })

    expect(warnings).toHaveLength(0)
  })

  it('returns no warnings when allowFrom is absent', () => {
    expect(getAllowFromWarnings({})).toHaveLength(0)
    expect(getAllowFromWarnings({ allowFrom: '' })).toHaveLength(0)
  })

  it('does not throw on nullish data', () => {
    expect(getAllowFromWarnings(undefined)).toHaveLength(0)
    expect(getAllowFromWarnings(null)).toHaveLength(0)
  })
})

import { summarizeBlueprintLintResults } from './designer'

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

describe('summarizeBlueprintLintResults', () => {
  it('builds counts for warnings and best-practice suggestions', () => {
    const summary = summarizeBlueprintLintResults([
      {
        nodeId: '#bot-1',
        type: 'bot',
        name: 'Support Bot',
        warnings: [
          {
            description:
              'Add description to this bot to help others understand what it can do and how to use it.',
            type: 'suggestion',
          },
          {
            description:
              'The model "bad-model" is not a supported model. Update the model field to a valid model ID.',
            type: 'warning',
          },
        ],
      },
      {
        nodeId: '#ability-1',
        type: 'ability',
        name: 'Search Ability',
        warnings: [
          {
            description:
              'Connect this ability to a skillset so that a bot can use it.',
            type: 'warning',
          },
        ],
      },
    ])

    expect(summary).toMatchObject({
      nodeCount: 2,
      totalCount: 3,
      warningCount: 2,
      suggestionCount: 1,
      hasWarnings: true,
    })

    expect(summary.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          nodeId: '#bot-1',
          nodeName: 'Support Bot',
          description: expect.stringContaining('Add description'),
          type: 'suggestion',
        }),
        expect.objectContaining({
          nodeId: '#ability-1',
          nodeType: 'ability',
          type: 'warning',
        }),
      ])
    )
  })

  it('lists nodes with warnings before suggestion-only nodes', () => {
    const summary = summarizeBlueprintLintResults([
      {
        nodeId: '#bot-1',
        type: 'bot',
        name: 'Suggestion Only Bot',
        warnings: [
          {
            description:
              'Add description to this bot to help others understand what it can do and how to use it.',
            type: 'suggestion',
          },
        ],
      },
      {
        nodeId: '#ability-1',
        type: 'ability',
        name: 'Warn First Ability',
        warnings: [
          {
            description:
              'Connect this ability to a skillset so that a bot can use it.',
            type: 'warning',
          },
        ],
      },
    ])

    expect(summary.nodes.map((node) => node.nodeId)).toEqual([
      '#ability-1',
      '#bot-1',
    ])

    expect(summary.items.map((item) => item.nodeId)).toEqual([
      '#ability-1',
      '#bot-1',
    ])
  })

  it('returns an empty summary when there are no lint results', () => {
    expect(summarizeBlueprintLintResults([])).toEqual({
      nodeCount: 0,
      totalCount: 0,
      warningCount: 0,
      suggestionCount: 0,
      hasWarnings: false,
      items: [],
      nodes: [],
    })
  })
})

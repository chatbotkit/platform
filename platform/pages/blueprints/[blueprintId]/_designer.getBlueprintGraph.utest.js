import { getBlueprintGraph, normalizeBlueprintChangeEdges } from './designer'

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

const allResources = {
  bot: {},
  dataset: {},
  secret: {},
  file: {},
  space: {},
  skillset: {},
  ability: {},
}

const nodeTypes = {
  bot: { dimensions: { width: 340, height: 140 } },
  dataset: { dimensions: { width: 340, height: 140 } },
  secret: { dimensions: { width: 340, height: 140 } },
  file: { dimensions: { width: 340, height: 140 } },
  space: { dimensions: { width: 340, height: 140 } },
  skillset: { dimensions: { width: 340, height: 140 } },
  ability: { dimensions: { width: 340, height: 140 } },
}

/** Project raw edges to the fields under test, keeping the raw targetHandle */
function pickEdges(edges) {
  return edges.map(({ source, sourceHandle, target, targetHandle }) => ({
    source,
    sourceHandle,
    target,
    targetHandle,
  }))
}

describe('getBlueprintGraph', () => {
  it('builds nodes and regular resource edges from a persisted blueprint', () => {
    const [, edges] = getBlueprintGraph({
      blueprint: {
        bots: [
          {
            id: 'bot-1',
            name: 'Support Bot',
            datasetId: 'dataset-1',
          },
        ],
        datasets: [{ id: 'dataset-1', name: 'Docs' }],
        config: {
          positions: {
            'bot-1': { x: 10, y: 20 },
            'dataset-1': { x: 200, y: 20 },
          },
        },
      },
      allResources,
      nodeTypes,
    })

    expect(normalizeBlueprintChangeEdges(edges)).toEqual([
      {
        source: 'bot-1',
        sourceHandle: 'datasetId',
        target: 'dataset-1',
        targetHandle: 'dataset',
      },
    ])
  })

  it('builds error log tool resource edges from persisted tool data', () => {
    const [, edges] = getBlueprintGraph({
      blueprint: {
        bots: [{ id: 'bot-1', name: 'Support Bot' }],
        datasets: [{ id: 'dataset-1', name: 'Docs' }],
        config: {
          positions: {
            'bot-1': { x: 10, y: 20 },
            'dataset-1': { x: 200, y: 20 },
          },
          tools: {
            '#tool:errorLog:::errors': {
              type: 'tool:errorLog',
              data: {
                name: 'Errors',
                resources: [
                  { type: 'bot', id: 'bot-1' },
                  { type: 'dataset', id: 'dataset-1' },
                ],
              },
              position: { x: 400, y: 20 },
              width: 280,
              height: 200,
            },
          },
        },
      },
      allResources,
      nodeTypes,
    })

    expect(normalizeBlueprintChangeEdges(edges)).toEqual([
      {
        source: '#tool:errorLog:::errors',
        sourceHandle: 'errorLogResource:0',
        target: 'bot-1',
        targetHandle: 'bot',
      },
      {
        source: '#tool:errorLog:::errors',
        sourceHandle: 'errorLogResource:1',
        target: 'dataset-1',
        targetHandle: 'dataset',
      },
    ])
  })

  it('routes ability linked*Id and skillsetId edges to their resource type handles', () => {
    const [, edges] = getBlueprintGraph({
      blueprint: {
        secrets: [{ id: 'secret-1', name: 'Token' }],
        files: [{ id: 'file-1', name: 'Manual' }],
        bots: [{ id: 'bot-1', name: 'Support Bot' }],
        spaces: [{ id: 'space-1', name: 'Workspace' }],
        skillsets: [{ id: 'skillset-1', name: 'Skills' }],
        abilities: [
          {
            id: 'ability-1',
            name: 'Lookup',
            skillsetId: 'skillset-1',
            linkedSecretId: 'secret-1',
            linkedFileId: 'file-1',
            linkedBotId: 'bot-1',
            linkedSpaceId: 'space-1',
          },
        ],
        config: { positions: {} },
      },
      allResources,
      nodeTypes,
    })

    const abilityEdges = pickEdges(
      edges.filter((edge) => edge.source === 'ability-1')
    )

    expect(abilityEdges).toHaveLength(5)
    expect(abilityEdges).toEqual(
      expect.arrayContaining([
        {
          source: 'ability-1',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillsetForAbility',
        },
        {
          source: 'ability-1',
          sourceHandle: 'linkedSecretId',
          target: 'secret-1',
          targetHandle: 'secret',
        },
        {
          source: 'ability-1',
          sourceHandle: 'linkedFileId',
          target: 'file-1',
          targetHandle: 'file',
        },
        {
          source: 'ability-1',
          sourceHandle: 'linkedBotId',
          target: 'bot-1',
          targetHandle: 'bot',
        },
        {
          source: 'ability-1',
          sourceHandle: 'linkedSpaceId',
          target: 'space-1',
          targetHandle: 'space',
        },
      ])
    )
    expect(edges).toHaveLength(5)
  })

  it('keeps plain *Id handles for non-ability resources', () => {
    const [, edges] = getBlueprintGraph({
      blueprint: {
        bots: [
          {
            id: 'bot-1',
            name: 'Support Bot',
            datasetId: 'dataset-1',
            skillsetId: 'skillset-1',
          },
        ],
        datasets: [{ id: 'dataset-1', name: 'Docs' }],
        skillsets: [{ id: 'skillset-1', name: 'Skills' }],
        config: { positions: {} },
      },
      allResources,
      nodeTypes,
    })

    expect(pickEdges(edges)).toEqual(
      expect.arrayContaining([
        {
          source: 'bot-1',
          sourceHandle: 'datasetId',
          target: 'dataset-1',
          targetHandle: 'dataset',
        },
        {
          source: 'bot-1',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillset',
        },
      ])
    )
    expect(edges).toHaveLength(2)
  })

  it('produces no edges for null linked*Id references', () => {
    const [nodes, edges] = getBlueprintGraph({
      blueprint: {
        skillsets: [{ id: 'skillset-1', name: 'Skills' }],
        abilities: [
          {
            id: 'ability-1',
            name: 'Lookup',
            skillsetId: 'skillset-1',
            linkedSecretId: null,
            linkedFileId: null,
            linkedBotId: null,
            linkedSpaceId: null,
          },
        ],
        config: { positions: {} },
      },
      allResources,
      nodeTypes,
    })

    expect(nodes.map((node) => node.id)).toEqual(['skillset-1', 'ability-1'])
    expect(pickEdges(edges)).toEqual([
      {
        source: 'ability-1',
        sourceHandle: 'skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillsetForAbility',
      },
    ])
  })
})

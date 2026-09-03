import {
  applyConnectionEdgeToNode,
  clearConnectionEdgeFromNode,
  filterEdgesWithExistingNodes,
  getBlueprintGraphChangeDiagnostics,
  getResourceReferenceEntries,
  hasBlueprintGraphChanges,
  normalizeBlueprintChangeEdges,
  syncEdgesWithNodeReferences,
} from './designer'

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

describe('connection edge persistence helpers', () => {
  it('persists top-level tool references from a manual connection edge', () => {
    const toolNode = {
      id: '#tool:spaceFileBrowser:::abc',
      type: 'tool:spaceFileBrowser',
      data: { name: 'Space Browser', refreshInterval: 30 },
    }

    const edge = {
      source: '#tool:spaceFileBrowser:::abc',
      sourceHandle: 'spaceId',
      target: 'space-1',
      targetHandle: 'space',
    }

    expect(applyConnectionEdgeToNode(toolNode, edge)).toEqual({
      ...toolNode,
      data: {
        ...toolNode.data,
        spaceId: 'space-1',
      },
    })
  })

  it('clears top-level tool references when a manual edge is disconnected', () => {
    const toolNode = {
      id: '#tool:spaceFileBrowser:::abc',
      type: 'tool:spaceFileBrowser',
      data: {
        name: 'Space Browser',
        refreshInterval: 30,
        spaceId: 'space-1',
      },
    }

    const edge = {
      source: '#tool:spaceFileBrowser:::abc',
      sourceHandle: 'spaceId',
      target: 'space-1',
      targetHandle: 'space',
    }

    expect(clearConnectionEdgeFromNode(toolNode, edge)).toEqual({
      ...toolNode,
      data: {
        ...toolNode.data,
        spaceId: null,
      },
    })
  })

  it('persists error log resource references from dynamic resource handles', () => {
    const toolNode = {
      id: '#tool:errorLog:::abc',
      type: 'tool:errorLog',
      data: { name: 'Error Log', refreshInterval: 60 },
    }

    const edge = {
      source: '#tool:errorLog:::abc',
      sourceHandle: 'errorLogResource:0',
      target: 'bot-1',
      targetHandle: 'bot',
    }

    expect(applyConnectionEdgeToNode(toolNode, edge)).toEqual({
      ...toolNode,
      data: {
        ...toolNode.data,
        resources: [{ type: 'bot', id: 'bot-1' }],
      },
    })
  })

  it('does not duplicate existing error log resource references', () => {
    const toolNode = {
      id: '#tool:errorLog:::abc',
      type: 'tool:errorLog',
      data: {
        name: 'Error Log',
        resources: [{ type: 'bot', id: 'bot-1' }],
      },
    }

    const edge = {
      source: '#tool:errorLog:::abc',
      sourceHandle: 'errorLogResource:1',
      target: 'bot-1',
      targetHandle: 'bot',
    }

    expect(applyConnectionEdgeToNode(toolNode, edge)).toBe(toolNode)
  })

  it('clears error log resource references when a dynamic edge is disconnected', () => {
    const toolNode = {
      id: '#tool:errorLog:::abc',
      type: 'tool:errorLog',
      data: {
        name: 'Error Log',
        resources: [
          { type: 'bot', id: 'bot-1' },
          { type: 'dataset', id: 'dataset-1' },
        ],
      },
    }

    const edge = {
      source: '#tool:errorLog:::abc',
      sourceHandle: 'errorLogResource:0',
      target: 'bot-1',
      targetHandle: 'bot',
    }

    expect(clearConnectionEdgeFromNode(toolNode, edge)).toEqual({
      ...toolNode,
      data: {
        ...toolNode.data,
        resources: [{ type: 'dataset', id: 'dataset-1' }],
      },
    })
  })

  it('updates ability instruction references via instruction handles', () => {
    const abilityNode = {
      id: 'ability-1',
      type: 'ability',
      data: {
        name: 'Read File',
        instruction:
          'template: file/rw[by-id]\nparams:\n  fileId: file-1\n  mode: read',
      },
    }

    const edge = {
      source: 'ability-1',
      sourceHandle: 'instruction:fileId',
      target: 'file-2',
      targetHandle: 'file',
    }

    expect(applyConnectionEdgeToNode(abilityNode, edge)).toEqual({
      ...abilityNode,
      data: {
        ...abilityNode.data,
        instruction:
          'template: file/rw[by-id]\nparams:\n  fileId: file-2\n  mode: read\n',
      },
    })
  })
})

describe('hasBlueprintGraphChanges', () => {
  it('returns false for identical normalized graphs', () => {
    const blueprintNodes = [
      {
        id: 'bot-1',
        type: 'bot',
        data: { name: 'Bot' },
        position: { x: 10, y: 20 },
        width: 340,
        height: 140,
      },
    ]

    expect(
      hasBlueprintGraphChanges({
        blueprintNodes,
        changedNodes: blueprintNodes,
        blueprintEdges: [],
        changedEdges: [],
      })
    ).toBe(false)
  })

  it('ignores transient resource data keys that the build path strips before persisting', () => {
    const blueprintNodes = [
      {
        id: 'bot-1',
        type: 'bot',
        data: { name: 'Bot', skillsetId: 'skillset-1' },
        position: { x: 10, y: 20 },
        width: 340,
        height: 140,
      },
      {
        id: 'skillset-1',
        type: 'skillset',
        data: { name: 'Support' },
        position: { x: 120, y: 20 },
        width: 340,
        height: 140,
      },
    ]

    const changedNodes = [
      {
        id: 'bot-1',
        type: 'bot',
        data: {
          name: 'Bot',
          skillsetId: 'skillset-1',
          _focusedField: 'name',
          DisplayName: 'Bot',
          'local draft': true,
        },
        position: { x: 10, y: 20 },
        width: 340,
        height: 140,
      },
      {
        id: 'skillset-1',
        type: 'skillset',
        data: { name: 'Support' },
        position: { x: 120, y: 20 },
        width: 340,
        height: 140,
      },
    ]

    const blueprintEdges = [
      {
        source: 'bot-1',
        sourceHandle: 'skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillset',
      },
    ]

    const changedEdges = [
      {
        id: '#edge:::1',
        source: 'bot-1',
        sourceHandle: 'skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillset',
        type: 'default',
        animated: true,
      },
    ]

    expect(
      hasBlueprintGraphChanges({
        blueprintNodes,
        changedNodes,
        blueprintEdges,
        changedEdges,
      })
    ).toBe(false)
  })

  it('returns true when persisted resource data actually changes', () => {
    const blueprintNodes = [
      {
        id: 'bot-1',
        type: 'bot',
        data: { name: 'Bot', skillsetId: 'skillset-1' },
        position: { x: 10, y: 20 },
        width: 340,
        height: 140,
      },
    ]

    const changedNodes = [
      {
        id: 'bot-1',
        type: 'bot',
        data: { name: 'Updated Bot', skillsetId: 'skillset-1' },
        position: { x: 10, y: 20 },
        width: 340,
        height: 140,
      },
    ]

    expect(
      hasBlueprintGraphChanges({
        blueprintNodes,
        changedNodes,
        blueprintEdges: [],
        changedEdges: [],
      })
    ).toBe(true)
  })

  it('returns true when normalized edge connections change', () => {
    const nodes = [
      {
        id: 'bot-1',
        type: 'bot',
        data: { name: 'Bot', skillsetId: 'skillset-1' },
        position: { x: 10, y: 20 },
        width: 340,
        height: 140,
      },
      {
        id: 'skillset-1',
        type: 'skillset',
        data: { name: 'Support' },
        position: { x: 120, y: 20 },
        width: 340,
        height: 140,
      },
      {
        id: 'skillset-2',
        type: 'skillset',
        data: { name: 'Sales' },
        position: { x: 240, y: 20 },
        width: 340,
        height: 140,
      },
    ]

    const blueprintEdges = [
      {
        source: 'bot-1',
        sourceHandle: 'skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillset',
      },
    ]

    const changedEdges = [
      {
        id: '#edge:::2',
        source: 'bot-1',
        sourceHandle: 'skillsetId',
        target: 'skillset-2',
        targetHandle: 'skillset',
        type: 'default',
        animated: true,
      },
    ]

    expect(
      hasBlueprintGraphChanges({
        blueprintNodes: nodes,
        changedNodes: nodes,
        blueprintEdges,
        changedEdges,
      })
    ).toBe(true)
  })

  it('ignores no changes when frame size matches persisted dimensions', () => {
    const blueprintNodes = [
      {
        id: '#frame:::9ar1hjghbs',
        type: 'frame',
        data: { label: 'My Frame' },
        position: { x: 0, y: 0 },
        width: 1530,
        height: 1150,
      },
    ]

    const changedNodes = [
      {
        id: '#frame:::9ar1hjghbs',
        type: 'frame',
        data: { label: 'My Frame' },
        position: { x: 0, y: 0 },
        width: 1530,
        height: 1150,
      },
    ]

    expect(
      hasBlueprintGraphChanges({
        blueprintNodes,
        changedNodes,
        blueprintEdges: [],
        changedEdges: [],
      })
    ).toBe(false)
  })

  it('detects real frame resize changes', () => {
    const blueprintNodes = [
      {
        id: '#frame:::9ar1hjghbs',
        type: 'frame',
        data: { label: 'My Frame' },
        position: { x: 0, y: 0 },
        width: 1530,
        height: 1150,
      },
    ]

    const changedNodes = [
      {
        id: '#frame:::9ar1hjghbs',
        type: 'frame',
        data: { label: 'My Frame' },
        position: { x: 0, y: 0 },
        width: 800,
        height: 600,
      },
    ]

    expect(
      hasBlueprintGraphChanges({
        blueprintNodes,
        changedNodes,
        blueprintEdges: [],
        changedEdges: [],
      })
    ).toBe(true)
  })

  it('ignores skillset handle routing differences for ability edges', () => {
    const nodes = [
      {
        id: 'ability-1',
        type: 'ability',
        data: { name: 'Search', skillsetId: 'skillset-1' },
        position: { x: 10, y: 20 },
        width: 340,
        height: 140,
      },
      {
        id: 'skillset-1',
        type: 'skillset',
        data: { name: 'Support' },
        position: { x: 120, y: 20 },
        width: 340,
        height: 140,
      },
    ]

    const blueprintEdges = [
      {
        source: 'ability-1',
        sourceHandle: 'skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillsetForAbility',
      },
    ]

    const changedEdges = [
      {
        id: '#edge:::ability-skillset',
        source: 'ability-1',
        sourceHandle: 'skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillset',
        type: 'default',
        animated: true,
      },
    ]

    expect(
      hasBlueprintGraphChanges({
        blueprintNodes: nodes,
        changedNodes: nodes,
        blueprintEdges,
        changedEdges,
      })
    ).toBe(false)
  })

  it('still detects real ability skillset changes despite handle normalization', () => {
    const nodes = [
      {
        id: 'ability-1',
        type: 'ability',
        data: { name: 'Search', skillsetId: 'skillset-2' },
        position: { x: 10, y: 20 },
        width: 340,
        height: 140,
      },
      {
        id: 'skillset-1',
        type: 'skillset',
        data: { name: 'Support' },
        position: { x: 120, y: 20 },
        width: 340,
        height: 140,
      },
      {
        id: 'skillset-2',
        type: 'skillset',
        data: { name: 'Sales' },
        position: { x: 240, y: 20 },
        width: 340,
        height: 140,
      },
    ]

    const blueprintEdges = [
      {
        source: 'ability-1',
        sourceHandle: 'skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillsetForAbility',
      },
    ]

    const changedEdges = [
      {
        source: 'ability-1',
        sourceHandle: 'skillsetId',
        target: 'skillset-2',
        targetHandle: 'skillset',
      },
    ]

    expect(
      hasBlueprintGraphChanges({
        blueprintNodes: nodes,
        changedNodes: nodes,
        blueprintEdges,
        changedEdges,
      })
    ).toBe(true)
  })

  it('does not normalize non-skillsetId handles', () => {
    const nodes = [
      {
        id: 'bot-1',
        type: 'bot',
        data: { name: 'Bot', datasetId: 'dataset-1' },
        position: { x: 10, y: 20 },
        width: 340,
        height: 140,
      },
      {
        id: 'dataset-1',
        type: 'dataset',
        data: { name: 'KB' },
        position: { x: 120, y: 20 },
        width: 340,
        height: 140,
      },
    ]

    const blueprintEdges = [
      {
        source: 'bot-1',
        sourceHandle: 'datasetId',
        target: 'dataset-1',
        targetHandle: 'dataset',
      },
    ]

    const changedEdges = [
      {
        source: 'bot-1',
        sourceHandle: 'datasetId',
        target: 'dataset-1',
        targetHandle: 'datasetOther',
      },
    ]

    expect(
      hasBlueprintGraphChanges({
        blueprintNodes: nodes,
        changedNodes: nodes,
        blueprintEdges,
        changedEdges,
      })
    ).toBe(true)
  })

  it('does not normalize instruction-prefixed skillsetId handles', () => {
    const nodes = [
      {
        id: 'ability-1',
        type: 'ability',
        data: { name: 'Search', skillsetId: 'skillset-1' },
        position: { x: 10, y: 20 },
        width: 340,
        height: 140,
      },
      {
        id: 'skillset-1',
        type: 'skillset',
        data: { name: 'Support' },
        position: { x: 120, y: 20 },
        width: 340,
        height: 140,
      },
    ]

    const blueprintEdges = [
      {
        source: 'ability-1',
        sourceHandle: 'instruction:skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillset',
      },
    ]

    const changedEdges = [
      {
        source: 'ability-1',
        sourceHandle: 'instruction:skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillsetForAbility',
      },
    ]

    expect(
      hasBlueprintGraphChanges({
        blueprintNodes: nodes,
        changedNodes: nodes,
        blueprintEdges,
        changedEdges,
      })
    ).toBe(true)
  })
})

describe('normalizeBlueprintChangeEdges', () => {
  it('canonicalizes skillsetForAbility to skillset for skillsetId edges', () => {
    const result = normalizeBlueprintChangeEdges([
      {
        source: 'a',
        sourceHandle: 'skillsetId',
        target: 'b',
        targetHandle: 'skillsetForAbility',
      },
    ])

    expect(result).toEqual([
      {
        source: 'a',
        sourceHandle: 'skillsetId',
        target: 'b',
        targetHandle: 'skillset',
      },
    ])
  })

  it('preserves skillset targetHandle for skillsetId edges', () => {
    const result = normalizeBlueprintChangeEdges([
      {
        source: 'a',
        sourceHandle: 'skillsetId',
        target: 'b',
        targetHandle: 'skillset',
      },
    ])

    expect(result).toEqual([
      {
        source: 'a',
        sourceHandle: 'skillsetId',
        target: 'b',
        targetHandle: 'skillset',
      },
    ])
  })

  it('does not normalize targetHandle when sourceHandle is not skillsetId', () => {
    const result = normalizeBlueprintChangeEdges([
      {
        source: 'a',
        sourceHandle: 'datasetId',
        target: 'b',
        targetHandle: 'dataset',
      },
      {
        source: 'a',
        sourceHandle: 'instruction:skillsetId',
        target: 'b',
        targetHandle: 'skillsetForAbility',
      },
    ])

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceHandle: 'datasetId',
          targetHandle: 'dataset',
        }),
        expect.objectContaining({
          sourceHandle: 'instruction:skillsetId',
          targetHandle: 'skillsetForAbility',
        }),
      ])
    )
  })

  it('strips extra properties and sorts edges deterministically', () => {
    const result = normalizeBlueprintChangeEdges([
      {
        id: 'z',
        source: 'b',
        sourceHandle: 'skillsetId',
        target: 'c',
        targetHandle: 'skillsetForAbility',
        type: 'default',
        animated: true,
      },
      {
        id: 'a',
        source: 'a',
        sourceHandle: 'datasetId',
        target: 'd',
        targetHandle: 'dataset',
        type: 'default',
      },
    ])

    // Should only have the four canonical keys, sorted
    expect(result[0]).toEqual({
      source: 'a',
      sourceHandle: 'datasetId',
      target: 'd',
      targetHandle: 'dataset',
    })
    expect(result[1]).toEqual({
      source: 'b',
      sourceHandle: 'skillsetId',
      target: 'c',
      targetHandle: 'skillset',
    })
    expect(Object.keys(result[0])).toEqual(
      expect.not.arrayContaining(['id', 'type', 'animated'])
    )
  })
})

describe('getBlueprintGraphChangeDiagnostics', () => {
  it('reports deleted nodes and edges so post-build warnings explain stale mismatches', () => {
    const blueprintNodes = [
      {
        id: '#tool:filePreview:::1',
        type: 'filePreviewTool',
        data: { fileId: 'file-1', refreshInterval: 30 },
        position: { x: 0, y: 100 },
        width: 340,
        height: 140,
      },
      {
        id: 'file-1',
        type: 'file',
        data: { name: 'Memory' },
        position: { x: 0, y: 0 },
        width: 180,
        height: 180,
      },
    ]

    const blueprintEdges = [
      {
        source: '#tool:filePreview:::1',
        sourceHandle: 'fileId',
        target: 'file-1',
        targetHandle: 'file',
      },
    ]

    const diagnostics = getBlueprintGraphChangeDiagnostics({
      blueprintNodes,
      changedNodes: [],
      blueprintEdges,
      changedEdges: [],
    })

    expect(diagnostics.hasChanges).toBe(true)
    expect(diagnostics.hasNodeChanges).toBe(true)
    expect(diagnostics.hasEdgeChanges).toBe(true)
    expect(diagnostics.nodeDiff.onlyInBlueprint).toEqual([
      {
        id: '#tool:filePreview:::1',
        data: { fileId: 'file-1', refreshInterval: 30 },
        position: { x: 0, y: 100 },
      },
      {
        id: 'file-1',
        data: { name: 'Memory' },
        position: { x: 0, y: 0 },
      },
    ])
    expect(diagnostics.nodeDiff.onlyInChanged).toEqual([])
    expect(diagnostics.nodeDiff.fieldDiffs).toEqual([])
    expect(diagnostics.edgeDiff).toEqual({
      blueprintEdges: [
        {
          source: '#tool:filePreview:::1',
          sourceHandle: 'fileId',
          target: 'file-1',
          targetHandle: 'file',
        },
      ],
      changedEdges: [],
    })
  })

  it('reports position-level mismatches for shared nodes', () => {
    const diagnostics = getBlueprintGraphChangeDiagnostics({
      blueprintNodes: [
        {
          id: 'note-1',
          type: 'note',
          data: { text: 'A' },
          position: { x: 10, y: 20 },
          width: 340,
          height: 140,
        },
      ],
      changedNodes: [
        {
          id: 'note-1',
          type: 'note',
          data: { text: 'A' },
          position: { x: 25, y: 20 },
          width: 340,
          height: 140,
        },
      ],
      blueprintEdges: [],
      changedEdges: [],
    })

    expect(diagnostics.nodeDiff.onlyInBlueprint).toEqual([])
    expect(diagnostics.nodeDiff.onlyInChanged).toEqual([])
    expect(diagnostics.nodeDiff.fieldDiffs).toEqual([
      {
        id: 'note-1',
        position: {
          blueprint: { x: 10, y: 20 },
          changed: { x: 25, y: 20 },
        },
      },
    ])
  })

  it('reports no edge changes when skillset handle differs only by routing variant', () => {
    const nodes = [
      {
        id: 'ability-1',
        type: 'ability',
        data: { name: 'Search', skillsetId: 'skillset-1' },
        position: { x: 10, y: 20 },
        width: 340,
        height: 140,
      },
      {
        id: 'skillset-1',
        type: 'skillset',
        data: { name: 'Support' },
        position: { x: 120, y: 20 },
        width: 340,
        height: 140,
      },
    ]

    const diagnostics = getBlueprintGraphChangeDiagnostics({
      blueprintNodes: nodes,
      changedNodes: nodes,
      blueprintEdges: [
        {
          source: 'ability-1',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillsetForAbility',
        },
      ],
      changedEdges: [
        {
          source: 'ability-1',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillset',
        },
      ],
    })

    expect(diagnostics.hasChanges).toBe(false)
    expect(diagnostics.hasEdgeChanges).toBe(false)
    expect(diagnostics.edgeDiff.blueprintEdges).toEqual(
      diagnostics.edgeDiff.changedEdges
    )
  })
})

describe('import/build regression coverage', () => {
  describe('syncEdgesWithNodeReferences', () => {
    it('adds missing top-level skillsetId edges for non-ability resources', () => {
      const nodes = [
        {
          id: 'mcp-1',
          type: 'mcpserverIntegration',
          data: { name: 'Docs MCP', skillsetId: 'skillset-1' },
          position: { x: 10, y: 20 },
          width: 180,
          height: 180,
        },
        {
          id: 'skillset-1',
          type: 'skillset',
          data: { name: 'Support' },
          position: { x: 200, y: 20 },
          width: 340,
          height: 140,
        },
      ]

      const syncedEdges = syncEdgesWithNodeReferences({
        nodes,
        edges: [],
      })

      expect(normalizeBlueprintChangeEdges(syncedEdges)).toEqual([
        {
          source: 'mcp-1',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillset',
        },
      ])
    })

    it('uses skillsetForAbility when rebuilding ability skillset edges', () => {
      const nodes = [
        {
          id: 'ability-1',
          type: 'ability',
          data: { name: 'Search', skillsetId: 'skillset-1' },
          position: { x: 10, y: 20 },
          width: 340,
          height: 140,
        },
        {
          id: 'skillset-1',
          type: 'skillset',
          data: { name: 'Support' },
          position: { x: 200, y: 20 },
          width: 340,
          height: 140,
        },
      ]

      const syncedEdges = syncEdgesWithNodeReferences({
        nodes,
        edges: [],
      })

      expect(normalizeBlueprintChangeEdges(syncedEdges)).toEqual([
        {
          source: 'ability-1',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillset',
        },
      ])

      expect(syncedEdges[0].targetHandle).toBe('skillsetForAbility')
    })

    it('retargets existing top-level reference edges when the node data changes', () => {
      const nodes = [
        {
          id: 'mcp-1',
          type: 'mcpserverIntegration',
          data: { name: 'Docs MCP', skillsetId: 'skillset-2' },
          position: { x: 10, y: 20 },
          width: 180,
          height: 180,
        },
        {
          id: 'skillset-1',
          type: 'skillset',
          data: { name: 'Old Skillset' },
          position: { x: 200, y: 20 },
          width: 340,
          height: 140,
        },
        {
          id: 'skillset-2',
          type: 'skillset',
          data: { name: 'New Skillset' },
          position: { x: 400, y: 20 },
          width: 340,
          height: 140,
        },
      ]

      const syncedEdges = syncEdgesWithNodeReferences({
        nodes,
        edges: [
          {
            id: '#edge:::1',
            source: 'mcp-1',
            sourceHandle: 'skillsetId',
            target: 'skillset-1',
            targetHandle: 'skillset',
            type: 'default',
            animated: true,
          },
        ],
      })

      expect(normalizeBlueprintChangeEdges(syncedEdges)).toEqual([
        {
          source: 'mcp-1',
          sourceHandle: 'skillsetId',
          target: 'skillset-2',
          targetHandle: 'skillset',
        },
      ])
    })

    it('removes stale top-level reference edges when the backing field is cleared', () => {
      const nodes = [
        {
          id: 'mcp-1',
          type: 'mcpserverIntegration',
          data: { name: 'Docs MCP', skillsetId: null },
          position: { x: 10, y: 20 },
          width: 180,
          height: 180,
        },
        {
          id: 'skillset-1',
          type: 'skillset',
          data: { name: 'Support' },
          position: { x: 200, y: 20 },
          width: 340,
          height: 140,
        },
      ]

      const syncedEdges = syncEdgesWithNodeReferences({
        nodes,
        edges: [
          {
            id: '#edge:::1',
            source: 'mcp-1',
            sourceHandle: 'skillsetId',
            target: 'skillset-1',
            targetHandle: 'skillset',
            type: 'default',
            animated: true,
          },
        ],
      })

      expect(normalizeBlueprintChangeEdges(syncedEdges)).toEqual([])
    })

    it('adds missing error log resource edges from tool data', () => {
      const nodes = [
        {
          id: '#tool:errorLog:::abc',
          type: 'tool:errorLog',
          data: {
            name: 'Error Log',
            resources: [
              { type: 'bot', id: 'bot-1' },
              { type: 'dataset', id: 'dataset-1' },
            ],
          },
          position: { x: 10, y: 20 },
          width: 280,
          height: 200,
        },
        {
          id: 'bot-1',
          type: 'bot',
          data: { name: 'Support Bot' },
          position: { x: 200, y: 20 },
          width: 340,
          height: 140,
        },
        {
          id: 'dataset-1',
          type: 'dataset',
          data: { name: 'Docs' },
          position: { x: 400, y: 20 },
          width: 340,
          height: 140,
        },
      ]

      const syncedEdges = syncEdgesWithNodeReferences({
        nodes,
        edges: [],
      })

      expect(normalizeBlueprintChangeEdges(syncedEdges)).toEqual([
        {
          source: '#tool:errorLog:::abc',
          sourceHandle: 'errorLogResource:0',
          target: 'bot-1',
          targetHandle: 'bot',
        },
        {
          source: '#tool:errorLog:::abc',
          sourceHandle: 'errorLogResource:1',
          target: 'dataset-1',
          targetHandle: 'dataset',
        },
      ])
    })

    it('removes stale error log resource edges when the backing resource list is cleared', () => {
      const nodes = [
        {
          id: '#tool:errorLog:::abc',
          type: 'tool:errorLog',
          data: {
            name: 'Error Log',
            resources: [],
          },
          position: { x: 10, y: 20 },
          width: 280,
          height: 200,
        },
        {
          id: 'bot-1',
          type: 'bot',
          data: { name: 'Support Bot' },
          position: { x: 200, y: 20 },
          width: 340,
          height: 140,
        },
      ]

      const syncedEdges = syncEdgesWithNodeReferences({
        nodes,
        edges: [
          {
            id: '#edge:::1',
            source: '#tool:errorLog:::abc',
            sourceHandle: 'errorLogResource:0',
            target: 'bot-1',
            targetHandle: 'bot',
            type: 'default',
            animated: true,
          },
        ],
      })

      expect(normalizeBlueprintChangeEdges(syncedEdges)).toEqual([])
    })
  })

  describe('getResourceReferenceEntries', () => {
    it('extracts top-level *Id fields from resource data', () => {
      const entries = getResourceReferenceEntries({
        name: 'My Bot',
        skillsetId: 'skillset-1',
        datasetId: 'dataset-1',
      })

      expect(entries).toEqual([
        {
          key: 'skillsetId',
          value: 'skillset-1',
          sourceHandle: 'skillsetId',
          targetHandle: 'skillset',
        },
        {
          key: 'datasetId',
          value: 'dataset-1',
          sourceHandle: 'datasetId',
          targetHandle: 'dataset',
        },
      ])
    })

    it('skips null or empty *Id fields', () => {
      const entries = getResourceReferenceEntries({
        skillsetId: null,
        datasetId: '',
      })

      expect(entries).toEqual([])
    })

    it('extracts instruction parameter references from ability data', () => {
      const entries = getResourceReferenceEntries({
        skillsetId: 'skillset-1',
        instruction:
          'template: file/rw[by-id]\nparams:\n  fileId: file-1\n  mode: read',
      })

      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'skillsetId',
            value: 'skillset-1',
            sourceHandle: 'skillsetId',
          }),
          expect.objectContaining({
            key: 'fileId',
            value: 'file-1',
            sourceHandle: 'instruction:fileId',
            targetHandle: 'file',
          }),
        ])
      )
    })

    it('does not extract references from tool config shapes', () => {
      const toolConfig = {
        type: 'tool:filePreview',
        data: { fileId: 'file-1', name: '', refreshInterval: 30 },
        position: { x: 0, y: 0 },
        width: 340,
        height: 305,
      }

      expect(getResourceReferenceEntries(toolConfig)).toEqual([])
      expect(getResourceReferenceEntries(toolConfig.data)).toEqual([
        {
          key: 'fileId',
          value: 'file-1',
          sourceHandle: 'fileId',
          targetHandle: 'file',
        },
      ])
    })
  })

  describe('tool edges missing from canvas', () => {
    const fileNode = {
      id: 'file-1',
      type: 'file',
      data: { name: 'Soul' },
      position: { x: 0, y: 0 },
      width: 180,
      height: 180,
    }

    const toolNode = {
      id: '#tool:filePreview:::abc',
      type: 'tool:filePreview',
      data: { fileId: 'file-1', refreshInterval: 30 },
      position: { x: 100, y: 100 },
      width: 340,
      height: 305,
    }

    const skillsetNode = {
      id: 'skillset-1',
      type: 'skillset',
      data: { name: 'Core Skills' },
      position: { x: 200, y: 0 },
      width: 340,
      height: 140,
    }

    const abilityNode = {
      id: 'ability-1',
      type: 'ability',
      data: { name: 'Read File', skillsetId: 'skillset-1' },
      position: { x: 300, y: 0 },
      width: 340,
      height: 140,
    }

    const allNodes = [fileNode, toolNode, skillsetNode, abilityNode]

    const blueprintEdges = [
      {
        source: '#tool:filePreview:::abc',
        sourceHandle: 'fileId',
        target: 'file-1',
        targetHandle: 'file',
      },
      {
        source: 'ability-1',
        sourceHandle: 'skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillset',
      },
    ]

    it('detects mismatch when imported canvas is missing tool edges', () => {
      const canvasEdges = [
        {
          id: '#edge:::1',
          source: 'ability-1',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillset',
          type: 'default',
          animated: true,
        },
      ]

      expect(
        hasBlueprintGraphChanges({
          blueprintNodes: allNodes,
          changedNodes: allNodes,
          blueprintEdges,
          changedEdges: canvasEdges,
        })
      ).toBe(true)

      const diagnostics = getBlueprintGraphChangeDiagnostics({
        blueprintNodes: allNodes,
        changedNodes: allNodes,
        blueprintEdges,
        changedEdges: canvasEdges,
      })

      expect(diagnostics.hasEdgeChanges).toBe(true)
      expect(diagnostics.hasNodeChanges).toBe(false)
      expect(diagnostics.edgeDiff.blueprintEdges).toHaveLength(2)
      expect(diagnostics.edgeDiff.changedEdges).toHaveLength(1)
    })

    it('reports no mismatch when tool edges exist in the canvas', () => {
      const canvasEdges = [
        {
          id: '#edge:::1',
          source: 'ability-1',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillset',
          type: 'default',
          animated: true,
        },
        {
          id: '#edge:::2',
          source: '#tool:filePreview:::abc',
          sourceHandle: 'fileId',
          target: 'file-1',
          targetHandle: 'file',
          type: 'default',
          animated: true,
        },
      ]

      expect(
        hasBlueprintGraphChanges({
          blueprintNodes: allNodes,
          changedNodes: allNodes,
          blueprintEdges,
          changedEdges: canvasEdges,
        })
      ).toBe(false)
    })
  })

  describe('stale #import::: instruction edges', () => {
    const fileNode = {
      id: 'file-1',
      type: 'file',
      data: { name: 'Soul' },
      position: { x: 0, y: 0 },
      width: 180,
      height: 180,
    }

    const skillsetNode = {
      id: 'skillset-1',
      type: 'skillset',
      data: { name: 'Core Skills' },
      position: { x: 200, y: 0 },
      width: 340,
      height: 140,
    }

    const abilityNodeAfterBuild = {
      id: 'cmn91a81k000704ikpq3wn7m7',
      type: 'ability',
      data: {
        name: 'Read File',
        skillsetId: 'skillset-1',
        instruction:
          'template: file/rw[by-id]\nparams:\n  fileId: file-1\n  mode: read',
      },
      position: { x: 300, y: 0 },
      width: 340,
      height: 140,
    }

    const allNodesAfterBuild = [fileNode, skillsetNode, abilityNodeAfterBuild]

    const blueprintEdges = [
      {
        source: 'cmn91a81k000704ikpq3wn7m7',
        sourceHandle: 'instruction:fileId',
        target: 'file-1',
        targetHandle: 'file',
      },
      {
        source: 'cmn91a81k000704ikpq3wn7m7',
        sourceHandle: 'skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillset',
      },
    ]

    it('filters orphan stale #import::: edges once temp source nodes are gone', () => {
      const canvasEdgesWithStaleSource = [
        {
          id: '#edge:::1',
          source: '#import:::q4kpaq8fagk',
          sourceHandle: 'instruction:fileId',
          target: 'file-1',
          targetHandle: 'file',
          type: 'default',
          animated: true,
        },
        {
          id: '#edge:::2',
          source: '#import:::sre97ii01uc',
          sourceHandle: 'instruction:fileId',
          target: 'file-1',
          targetHandle: 'file',
          type: 'default',
          animated: true,
        },
        {
          id: '#edge:::3',
          source: 'cmn91a81k000704ikpq3wn7m7',
          sourceHandle: 'instruction:fileId',
          target: 'file-1',
          targetHandle: 'file',
          type: 'default',
          animated: true,
        },
        {
          id: '#edge:::4',
          source: 'cmn91a81k000704ikpq3wn7m7',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillset',
          type: 'default',
          animated: true,
        },
      ]

      expect(
        filterEdgesWithExistingNodes(
          canvasEdgesWithStaleSource,
          allNodesAfterBuild
        )
      ).toEqual([
        {
          id: '#edge:::3',
          source: 'cmn91a81k000704ikpq3wn7m7',
          sourceHandle: 'instruction:fileId',
          target: 'file-1',
          targetHandle: 'file',
          type: 'default',
          animated: true,
        },
        {
          id: '#edge:::4',
          source: 'cmn91a81k000704ikpq3wn7m7',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillset',
          type: 'default',
          animated: true,
        },
      ])
    })

    it('detects mismatch when canvas still has stale #import::: sources', () => {
      const canvasEdgesWithStaleSource = [
        {
          id: '#edge:::1',
          source: '#import:::q4kpaq8fagk',
          sourceHandle: 'instruction:fileId',
          target: 'file-1',
          targetHandle: 'file',
          type: 'default',
          animated: true,
        },
        {
          id: '#edge:::2',
          source: 'cmn91a81k000704ikpq3wn7m7',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillset',
          type: 'default',
          animated: true,
        },
      ]

      expect(
        hasBlueprintGraphChanges({
          blueprintNodes: allNodesAfterBuild,
          changedNodes: allNodesAfterBuild,
          blueprintEdges,
          changedEdges: canvasEdgesWithStaleSource,
        })
      ).toBe(true)

      const diagnostics = getBlueprintGraphChangeDiagnostics({
        blueprintNodes: allNodesAfterBuild,
        changedNodes: allNodesAfterBuild,
        blueprintEdges,
        changedEdges: canvasEdgesWithStaleSource,
      })

      expect(diagnostics.hasEdgeChanges).toBe(true)

      const bpSources = diagnostics.edgeDiff.blueprintEdges.map((e) => e.source)
      const canvasSources = diagnostics.edgeDiff.changedEdges.map(
        (e) => e.source
      )

      expect(bpSources).not.toContain('#import:::q4kpaq8fagk')
      expect(canvasSources).toContain('#import:::q4kpaq8fagk')
    })

    it('reports no mismatch when canvas edges use real persisted IDs', () => {
      const canvasEdgesWithRealIds = [
        {
          id: '#edge:::1',
          source: 'cmn91a81k000704ikpq3wn7m7',
          sourceHandle: 'instruction:fileId',
          target: 'file-1',
          targetHandle: 'file',
          type: 'default',
          animated: true,
        },
        {
          id: '#edge:::2',
          source: 'cmn91a81k000704ikpq3wn7m7',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillset',
          type: 'default',
          animated: true,
        },
      ]

      expect(
        hasBlueprintGraphChanges({
          blueprintNodes: allNodesAfterBuild,
          changedNodes: allNodesAfterBuild,
          blueprintEdges,
          changedEdges: canvasEdgesWithRealIds,
        })
      ).toBe(false)
    })
  })

  describe('OpenClaw-shaped blueprint', () => {
    const bot = {
      id: 'bot-1',
      type: 'bot',
      data: { name: 'OpenClaw Agent', skillsetId: 'skillset-1' },
      position: { x: 300, y: 405 },
      width: 340,
      height: 140,
    }

    const skillset = {
      id: 'skillset-1',
      type: 'skillset',
      data: { name: 'OpenClaw Core Skills' },
      position: { x: 600, y: 750 },
      width: 340,
      height: 140,
    }

    const fileSoul = {
      id: 'file-soul',
      type: 'file',
      data: { name: 'Soul' },
      position: { x: -405, y: 615 },
      width: 180,
      height: 180,
    }

    const fileMemory = {
      id: 'file-memory',
      type: 'file',
      data: { name: 'Memory' },
      position: { x: -15, y: 615 },
      width: 180,
      height: 180,
    }

    const fileTools = {
      id: 'file-tools',
      type: 'file',
      data: { name: 'Tools' },
      position: { x: -210, y: 615 },
      width: 180,
      height: 180,
    }

    const abilityListFiles = {
      id: 'ability-list',
      type: 'ability',
      data: {
        name: '[SYSTEM] List Agent Files',
        skillsetId: 'skillset-1',
        instruction:
          'template: "blueprint/resource/list"\nparameters:\n  type: file',
      },
      position: { x: 210, y: 615 },
      width: 340,
      height: 140,
    }

    const abilityLoadFile = {
      id: 'ability-load',
      type: 'ability',
      data: {
        name: '[SYSTEM] Load Agent File by ID',
        skillsetId: 'skillset-1',
        instruction:
          'template: "file/read[by-id]"\nparameters:\n  fileId: !string\n    name: "fileId"\n    description: "the file Id"\n    optional: false\n    placeholder: true',
      },
      position: { x: 210, y: 765 },
      width: 340,
      height: 140,
    }

    const abilityReadMemory = {
      id: 'ability-read',
      type: 'ability',
      data: {
        name: '[SYSTEM] Read Agent Memory',
        skillsetId: 'skillset-1',
        instruction:
          'template: file/rw[by-id]\nparams:\n  fileId: file-memory\n  mode: read',
      },
      position: { x: 210, y: 930 },
      width: 340,
      height: 140,
    }

    const abilityWriteMemory = {
      id: 'ability-write',
      type: 'ability',
      data: {
        name: '[SYSTEM] Write Agent Memory',
        skillsetId: 'skillset-1',
        instruction:
          'template: file/rw[by-id]\nparams:\n  fileId: file-memory\n  mode: write',
      },
      position: { x: 210, y: 1095 },
      width: 340,
      height: 140,
    }

    const toolSoulPreview = {
      id: '#tool:filePreview:::soul',
      type: 'tool:filePreview',
      data: { fileId: 'file-soul', refreshInterval: 30 },
      position: { x: -900, y: 930 },
      width: 340,
      height: 305,
    }

    const toolToolsPreview = {
      id: '#tool:filePreview:::tools',
      type: 'tool:filePreview',
      data: { fileId: 'file-tools', refreshInterval: 30 },
      position: { x: -540, y: 930 },
      width: 340,
      height: 305,
    }

    const toolMemoryPreview = {
      id: '#tool:filePreview:::mem',
      type: 'tool:filePreview',
      data: { fileId: 'file-memory', refreshInterval: 30 },
      position: { x: -180, y: 930 },
      width: 340,
      height: 305,
    }

    const allNodes = [
      bot,
      skillset,
      fileSoul,
      fileMemory,
      fileTools,
      abilityListFiles,
      abilityLoadFile,
      abilityReadMemory,
      abilityWriteMemory,
      toolSoulPreview,
      toolToolsPreview,
      toolMemoryPreview,
    ]

    const blueprintEdges = [
      {
        source: 'bot-1',
        sourceHandle: 'skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillset',
      },
      {
        source: 'ability-list',
        sourceHandle: 'skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillsetForAbility',
      },
      {
        source: 'ability-load',
        sourceHandle: 'skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillsetForAbility',
      },
      {
        source: 'ability-read',
        sourceHandle: 'skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillsetForAbility',
      },
      {
        source: 'ability-write',
        sourceHandle: 'skillsetId',
        target: 'skillset-1',
        targetHandle: 'skillsetForAbility',
      },
      {
        source: 'ability-read',
        sourceHandle: 'instruction:fileId',
        target: 'file-memory',
        targetHandle: 'file',
      },
      {
        source: 'ability-write',
        sourceHandle: 'instruction:fileId',
        target: 'file-memory',
        targetHandle: 'file',
      },
      {
        source: '#tool:filePreview:::soul',
        sourceHandle: 'fileId',
        target: 'file-soul',
        targetHandle: 'file',
      },
      {
        source: '#tool:filePreview:::tools',
        sourceHandle: 'fileId',
        target: 'file-tools',
        targetHandle: 'file',
      },
      {
        source: '#tool:filePreview:::mem',
        sourceHandle: 'fileId',
        target: 'file-memory',
        targetHandle: 'file',
      },
    ]

    it('detects false changes when the imported canvas is missing all 3 tool edges', () => {
      const canvasEdges = [
        {
          source: 'bot-1',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillset',
        },
        {
          source: 'ability-list',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillsetForAbility',
        },
        {
          source: 'ability-load',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillsetForAbility',
        },
        {
          source: 'ability-read',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillsetForAbility',
        },
        {
          source: 'ability-write',
          sourceHandle: 'skillsetId',
          target: 'skillset-1',
          targetHandle: 'skillsetForAbility',
        },
        {
          source: 'ability-read',
          sourceHandle: 'instruction:fileId',
          target: 'file-memory',
          targetHandle: 'file',
        },
        {
          source: 'ability-write',
          sourceHandle: 'instruction:fileId',
          target: 'file-memory',
          targetHandle: 'file',
        },
      ]

      const diagnostics = getBlueprintGraphChangeDiagnostics({
        blueprintNodes: allNodes,
        changedNodes: allNodes,
        blueprintEdges,
        changedEdges: canvasEdges,
      })

      expect(diagnostics.hasEdgeChanges).toBe(true)
      expect(diagnostics.edgeDiff.blueprintEdges).toHaveLength(10)
      expect(diagnostics.edgeDiff.changedEdges).toHaveLength(7)
    })

    it('reports no changes when all expected edges are present', () => {
      expect(
        hasBlueprintGraphChanges({
          blueprintNodes: allNodes,
          changedNodes: allNodes,
          blueprintEdges,
          changedEdges: blueprintEdges,
        })
      ).toBe(false)
    })
  })
})

/* eslint-disable @typescript-eslint/no-require-imports */
import { applyBlueprintFromText } from './designer'

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

const toast = require('@/lib/toast')

/** Minimal opts object with empty current graph state */
function makeOpts(currentNodes = []) {
  const setNodes = jest.fn()
  const setEdges = jest.fn((fn) => fn([]))

  return {
    getNodes: () => currentNodes,
    setNodes,
    setEdges,
    allResources: {},
    nodeTypes: {},
    _setNodes: setNodes,
    _setEdges: setEdges,
  }
}

describe('applyBlueprintFromText', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('throws on invalid YAML text', () => {
    const opts = makeOpts()

    expect(() =>
      applyBlueprintFromText('not valid: yaml: at all: {]', opts)
    ).toThrow()
  })

  it('throws when the resources key is missing', () => {
    const opts = makeOpts()

    expect(() => applyBlueprintFromText('something: true\n', opts)).toThrow(
      'Invalid blueprint format'
    )
  })

  it('creates new nodes from the YAML', () => {
    const opts = makeOpts()
    const yaml = `
resources:
  "#bot-1":
    type: bot
    data:
      name: My Bot
`
    const result = applyBlueprintFromText(yaml, opts)

    expect(result.success).toBe(true)
    expect(result.created).toBe(1)
    expect(result.updated).toBe(0)
    expect(result.removed).toBe(0)

    const [nodes] = opts._setNodes.mock.calls[0]

    expect(nodes.some((n) => n.id === '#bot-1' && n.type === 'bot')).toBe(true)
  })

  it('updates existing nodes that match incoming IDs', () => {
    const existing = [
      {
        id: '#bot-1',
        type: 'bot',
        data: { name: 'Old Name' },
        width: 340,
        height: 140,
        position: { x: 0, y: 0 },
      },
    ]
    const opts = makeOpts(existing)
    const yaml = `
resources:
  "#bot-1":
    type: bot
    data:
      name: New Name
`
    const result = applyBlueprintFromText(yaml, opts)

    expect(result.created).toBe(0)
    expect(result.updated).toBe(1)

    const [nodes] = opts._setNodes.mock.calls[0]
    const updatedBot = nodes.find((n) => n.id === '#bot-1')

    expect(updatedBot.data.name).toBe('New Name')
  })

  it('removes resource nodes that are not in the incoming YAML', () => {
    const existing = [
      {
        id: '#bot-1',
        type: 'bot',
        data: {},
        width: 340,
        height: 140,
        position: { x: 0, y: 0 },
      },
      {
        id: '#bot-2',
        type: 'bot',
        data: {},
        width: 340,
        height: 140,
        position: { x: 0, y: 0 },
      },
    ]
    const opts = makeOpts(existing)
    const yaml = `
resources:
  "#bot-1":
    type: bot
    data: {}
`
    const result = applyBlueprintFromText(yaml, opts)

    expect(result.removed).toBe(1)

    const [nodes] = opts._setNodes.mock.calls[0]

    expect(nodes.some((n) => n.id === '#bot-2')).toBe(false)
  })

  it('preserves existing annotation nodes not mentioned in the YAML', () => {
    const existing = [
      {
        id: '#note-1',
        type: 'note',
        data: { text: 'keep me' },
        position: { x: 0, y: 0 },
        width: 200,
        height: 100,
      },
    ]
    const opts = makeOpts(existing)
    const yaml = `
resources:
  "#bot-1":
    type: bot
    data: {}
`

    applyBlueprintFromText(yaml, opts)

    const [nodes] = opts._setNodes.mock.calls[0]

    expect(nodes.some((n) => n.id === '#note-1')).toBe(true)
  })

  it('builds an edge for each *Id field in resource data', () => {
    const opts = makeOpts()

    // @note setEdges is called with a function; capture what edges it produces
    const capturedEdges = []

    opts._setEdges.mockImplementation((fn) => capturedEdges.push(...fn([])))

    const yaml = `
resources:
  "#bot-1":
    type: bot
    data:
      skillsetId: "#skillset-1"
  "#skillset-1":
    type: skillset
    data: {}
`

    applyBlueprintFromText(yaml, opts)

    const edge = capturedEdges.find(
      (e) => e.source === '#bot-1' && e.sourceHandle === 'skillsetId'
    )

    expect(edge).toBeDefined()
    expect(edge.target).toBe('#skillset-1')
    expect(edge.targetHandle).toBe('skillset')
  })

  it.each([
    ['linkedSecretId', 'secret'],
    ['linkedFileId', 'file'],
    ['linkedBotId', 'bot'],
    ['linkedSpaceId', 'space'],
  ])(
    'builds an edge for an ability `%s` link targeting a `%s` node',
    (linkedKey, resourceType) => {
      const opts = makeOpts()

      const capturedEdges = []

      opts._setEdges.mockImplementation((fn) => capturedEdges.push(...fn([])))

      const yaml = `
resources:
  "#skillset-1":
    type: skillset
    data: {}
  "#ability-1":
    type: ability
    data:
      name: Search
      description: Search the web
      instruction: "@platform/web-search"
      skillsetId: "#skillset-1"
      ${linkedKey}: "#${resourceType}-1"
  "#${resourceType}-1":
    type: ${resourceType}
    data: {}
`

      applyBlueprintFromText(yaml, opts)

      const edge = capturedEdges.find(
        (e) => e.source === '#ability-1' && e.sourceHandle === linkedKey
      )

      expect(edge).toBeDefined()
      expect(edge.target).toBe(`#${resourceType}-1`)
      expect(edge.targetHandle).toBe(resourceType)
    }
  )

  it('returns correct counts for annotations and tools sections', () => {
    const opts = makeOpts()
    const yaml = `
resources:
  "#bot-1":
    type: bot
    data: {}
annotations:
  "#note-1":
    type: note
    data:
      text: hello
    position:
      x: 0
      y: 0
    width: 200
    height: 100
tools:
  "#tool-1":
    type: "tool:code"
    data: {}
    position:
      x: 0
      y: 0
    width: 280
    height: 200
`
    const result = applyBlueprintFromText(yaml, opts)

    expect(result.annotationCount).toBe(1)
    expect(result.toolCount).toBe(1)
    expect(result.totalNodes).toBe(1)
  })

  it('merges incoming annotation data with existing annotation nodes', () => {
    const existing = [
      {
        id: '#note-1',
        type: 'note',
        data: { text: 'old' },
        position: { x: 0, y: 0 },
        width: 200,
        height: 100,
      },
    ]
    const opts = makeOpts(existing)
    const yaml = `
resources: {}
annotations:
  "#note-1":
    type: note
    data:
      text: updated
    position:
      x: 50
      y: 60
    width: 300
    height: 150
`

    applyBlueprintFromText(yaml, opts)

    const [nodes] = opts._setNodes.mock.calls[0]
    const note = nodes.find((n) => n.id === '#note-1')

    expect(note.data.text).toBe('updated')
    expect(note.position).toEqual({ x: 50, y: 60 })
  })

  it('shows a toast notification when nodes are created', () => {
    const opts = makeOpts()
    const yaml = `
resources:
  "#bot-1":
    type: bot
    data: {}
`

    applyBlueprintFromText(yaml, opts)

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining('created')
    )
  })

  it('throws when resource data has wrong field types', () => {
    const opts = makeOpts()
    const yaml = `
resources:
  "#bot-1":
    type: bot
    data:
      name: 123
`

    expect(() => applyBlueprintFromText(yaml, opts)).toThrow(
      'Blueprint validation failed'
    )

    expect(opts._setNodes).not.toHaveBeenCalled()
  })

  it('throws with per-node error details for invalid data', () => {
    const opts = makeOpts()
    const yaml = `
resources:
  "#bot-1":
    type: bot
    data:
      name: true
  "#bot-2":
    type: bot
    data:
      name: My Bot
`

    expect(() => applyBlueprintFromText(yaml, opts)).toThrow('#bot-1')
    expect(opts._setNodes).not.toHaveBeenCalled()
  })

  it('throws when a resource is missing its type', () => {
    const opts = makeOpts()
    const yaml = `
resources:
  "#bot-1":
    data:
      name: My Bot
`

    expect(() => applyBlueprintFromText(yaml, opts)).toThrow(
      'missing resource type'
    )
    expect(opts._setNodes).not.toHaveBeenCalled()
  })

  it('accepts valid data that passes schema validation', () => {
    const opts = makeOpts()
    const yaml = `
resources:
  "#bot-1":
    type: bot
    data:
      name: My Bot
      description: A helpful bot
`

    const result = applyBlueprintFromText(yaml, opts)

    expect(result.success).toBe(true)
    expect(result.created).toBe(1)
  })

  it('throws when a new ability is not linked to any skillset', () => {
    const opts = makeOpts()
    const yaml = `
resources:
  "#ability-1":
    type: ability
    data:
      name: My Ability
      description: Does something
      instruction: do something
`

    expect(() => applyBlueprintFromText(yaml, opts)).toThrow(
      'not linked to any skillset'
    )
    expect(opts._setNodes).not.toHaveBeenCalled()
  })

  it('throws listing all unlinked abilities by name', () => {
    const opts = makeOpts()
    const yaml = `
resources:
  "#ability-1":
    type: ability
    data:
      name: First
      description: test
      instruction: test
  "#ability-2":
    type: ability
    data:
      name: Second
      description: test
      instruction: test
`

    expect(() => applyBlueprintFromText(yaml, opts)).toThrow('First')
    expect(() => applyBlueprintFromText(yaml, opts)).toThrow('Second')
  })

  it('allows new abilities that have a skillsetId', () => {
    const opts = makeOpts()
    const yaml = `
resources:
  "#skillset-1":
    type: skillset
    data:
      name: My Skillset
  "#ability-1":
    type: ability
    data:
      name: My Ability
      description: Does something
      instruction: do something
      skillsetId: "#skillset-1"
`

    const result = applyBlueprintFromText(yaml, opts)

    expect(result.success).toBe(true)
    expect(result.created).toBe(2)
  })

  it('does not throw for existing abilities without skillsetId on update', () => {
    const existing = [
      {
        id: '#ability-1',
        type: 'ability',
        data: { name: 'Old', description: 'test', instruction: 'test' },
        width: 340,
        height: 140,
        position: { x: 0, y: 0 },
      },
    ]
    const opts = makeOpts(existing)
    const yaml = `
resources:
  "#ability-1":
    type: ability
    data:
      name: Updated Name
      description: test
      instruction: test
`

    const result = applyBlueprintFromText(yaml, opts)

    expect(result.success).toBe(true)
    expect(result.updated).toBe(1)
  })

  it('throws when a new secret is not linked to any ability', () => {
    const opts = makeOpts()
    const yaml = `
resources:
  "#secret-1":
    type: secret
    data:
      name: My Secret
`

    expect(() => applyBlueprintFromText(yaml, opts)).toThrow(
      'not linked to any ability'
    )
    expect(opts._setNodes).not.toHaveBeenCalled()
  })

  it('throws listing all unlinked secrets by name', () => {
    const opts = makeOpts()
    const yaml = `
resources:
  "#secret-1":
    type: secret
    data:
      name: First Secret
  "#secret-2":
    type: secret
    data:
      name: Second Secret
`

    expect(() => applyBlueprintFromText(yaml, opts)).toThrow('First Secret')
    expect(() => applyBlueprintFromText(yaml, opts)).toThrow('Second Secret')
  })

  it('allows new secrets that are referenced by an ability via linkedSecretId', () => {
    const opts = makeOpts()
    const yaml = `
resources:
  "#skillset-1":
    type: skillset
    data:
      name: My Skillset
  "#ability-1":
    type: ability
    data:
      name: My Ability
      description: Does something
      instruction: do something
      skillsetId: "#skillset-1"
      linkedSecretId: "#secret-1"
  "#secret-1":
    type: secret
    data:
      name: My Secret
`

    const result = applyBlueprintFromText(yaml, opts)

    expect(result.success).toBe(true)
    expect(result.created).toBe(3)
  })

  it('aggregates schema errors, unlinked abilities, and unlinked secrets into one error', () => {
    const opts = makeOpts()
    const yaml = `
resources:
  "#bot-1":
    type: bot
    data:
      name: 123
  "#ability-1":
    type: ability
    data:
      name: Bad Ability
      description: test
      instruction: test
  "#secret-1":
    type: secret
    data:
      name: Orphan Secret
`

    expect(() => applyBlueprintFromText(yaml, opts)).toThrow(
      'Blueprint validation failed'
    )
    expect(() => applyBlueprintFromText(yaml, opts)).toThrow('#bot-1')
    expect(() => applyBlueprintFromText(yaml, opts)).toThrow('Bad Ability')
    expect(() => applyBlueprintFromText(yaml, opts)).toThrow('Orphan Secret')
    expect(opts._setNodes).not.toHaveBeenCalled()
  })

  it('does not throw for existing abilities without skillsetId on update', () => {
    const existing = [
      {
        id: '#ability-1',
        type: 'ability',
        data: { name: 'Old', description: 'test', instruction: 'test' },
        width: 340,
        height: 140,
        position: { x: 0, y: 0 },
      },
    ]
    const opts = makeOpts(existing)
    const yaml = `
resources:
  "#ability-1":
    type: ability
    data:
      name: Updated Name
      description: test
      instruction: test
`

    const result = applyBlueprintFromText(yaml, opts)

    expect(result.success).toBe(true)
    expect(result.updated).toBe(1)
  })

  it('does not throw for existing secrets without ability link on update', () => {
    const existing = [
      {
        id: '#secret-1',
        type: 'secret',
        data: { name: 'Old Secret' },
        width: 340,
        height: 140,
        position: { x: 0, y: 0 },
      },
    ]
    const opts = makeOpts(existing)
    const yaml = `
resources:
  "#secret-1":
    type: secret
    data:
      name: Updated Secret
`

    const result = applyBlueprintFromText(yaml, opts)

    expect(result.success).toBe(true)
    expect(result.updated).toBe(1)
  })
})

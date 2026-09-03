import {
  buildAllResources,
  getToolbarFacetDefinitions,
  getToolbarFacetEntriesForActiveTab,
  matchesToolbarTabFacets,
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

describe('toolbar facet helpers', () => {
  it('uses the same non-production filters for ability-template tabs', () => {
    const definitions = getToolbarFacetDefinitions('abilities', [
      { type: 'cbk/search', provider: 'cbk', tags: ['beta'] },
      { type: 'google/calendar/create', provider: 'google', tags: [] },
    ])

    expect(definitions).toEqual([
      { label: 'Stable', value: 'stable' },
      { label: 'Beta', value: 'beta' },
      { label: 'Alpha', value: 'alpha' },
      { label: 'All', value: 'all' },
    ])
  })

  it('uses the same non-production filters for packs, mcps, and mocks', () => {
    for (const activeTab of ['packs', 'mcps', 'mocks']) {
      expect(
        getToolbarFacetDefinitions(activeTab, [{ type: 'entry', tags: [] }])
      ).toEqual([
        { label: 'Stable', value: 'stable' },
        { label: 'Beta', value: 'beta' },
        { label: 'Alpha', value: 'alpha' },
        { label: 'All', value: 'all' },
      ])
    }
  })

  it('uses platform, beta, alpha, and all filters for secrets in non-production', () => {
    const definitions = getToolbarFacetDefinitions('secrets', [
      { type: 'platform/openai', tags: [] },
      { type: 'external/custom', tags: ['beta'] },
    ])

    expect(definitions).toEqual([
      { label: 'Platform', value: 'platform' },
      { label: 'Beta', value: 'beta' },
      { label: 'Alpha', value: 'alpha' },
      { label: 'All', value: 'all' },
    ])
  })

  it('matches entries using platform filter for secrets', () => {
    expect(
      matchesToolbarTabFacets(
        { type: 'platform/openai', tags: [] },
        'secrets',
        'platform'
      )
    ).toBe(true)

    expect(
      matchesToolbarTabFacets(
        { type: 'external/custom', tags: [] },
        'secrets',
        'platform'
      )
    ).toBe(false)
  })

  it('matches entries using beta filter', () => {
    expect(
      matchesToolbarTabFacets(
        { type: 'cbk/search', provider: 'cbk', tags: ['beta'] },
        'abilities',
        'beta'
      )
    ).toBe(true)

    expect(
      matchesToolbarTabFacets(
        { type: 'cbk/search', provider: 'cbk', tags: ['new'] },
        'abilities',
        'beta'
      )
    ).toBe(false)
  })

  it('matches entries using stable filter (excludes beta/alpha)', () => {
    expect(
      matchesToolbarTabFacets(
        { type: 'google/calendar/create', provider: 'google', tags: [] },
        'abilities',
        'stable'
      )
    ).toBe(true)

    expect(
      matchesToolbarTabFacets(
        { type: 'cbk/search', provider: 'cbk', tags: ['beta'] },
        'abilities',
        'stable'
      )
    ).toBe(false)

    expect(
      matchesToolbarTabFacets(
        { type: 'cbk/experimental', provider: 'cbk', tags: ['alpha'] },
        'abilities',
        'stable'
      )
    ).toBe(false)
  })

  it('matches all entries when filter is all', () => {
    expect(
      matchesToolbarTabFacets(
        { type: 'google/calendar/create', provider: 'google', tags: [] },
        'abilities',
        'all'
      )
    ).toBe(true)
  })

  it('matches secret entries using beta and alpha filters', () => {
    expect(
      matchesToolbarTabFacets(
        { type: 'external/custom', tags: ['beta'] },
        'secrets',
        'beta'
      )
    ).toBe(true)

    expect(
      matchesToolbarTabFacets(
        { type: 'external/custom', tags: ['alpha'] },
        'secrets',
        'alpha'
      )
    ).toBe(true)

    expect(
      matchesToolbarTabFacets(
        { type: 'external/custom', tags: [] },
        'secrets',
        'beta'
      )
    ).toBe(false)
  })

  it('builds dangling facet entries from resource metadata', () => {
    const entries = getToolbarFacetEntriesForActiveTab({
      activeTab: 'dangling',
      allResources: {
        ability: { tags: ['beta'], provider: 'cbk', title: 'Ability' },
        secret: { tags: ['new'], title: 'Secret' },
      },
      danglingResources: {
        ability: [{ id: 'ability-1' }],
        secret: [{ id: 'secret-1' }],
      },
    })

    expect(entries).toEqual([
      {
        id: 'ability-1',
        type: 'ability',
        tags: ['beta'],
        provider: 'cbk',
        title: 'Ability',
      },
      {
        id: 'secret-1',
        type: 'secret',
        tags: ['new'],
        title: 'Secret',
      },
    ])
  })

  it('includes compliance resources in resource tab entries and all resources', () => {
    expect(
      getToolbarFacetEntriesForActiveTab({
        activeTab: 'resources',
      }).map((entry) => entry.type)
    ).toContain('policy')

    expect(buildAllResources({}, {})).toHaveProperty('policy')
  })
})

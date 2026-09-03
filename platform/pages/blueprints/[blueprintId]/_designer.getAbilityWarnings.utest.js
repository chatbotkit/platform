import { getAbilityWarnings } from './designer'

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

describe('getAbilityWarnings', () => {
  it('warns when name is missing', () => {
    const warnings = getAbilityWarnings({
      description: 'test',
      instruction: 'test',
      skillsetId: '1',
    })

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
    const warnings = getAbilityWarnings({
      name: 'test',
      instruction: 'test',
      skillsetId: '1',
    })

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('description'),
          type: 'suggestion',
        }),
      ])
    )
  })

  it('warns when instruction is missing', () => {
    const warnings = getAbilityWarnings({
      name: 'test',
      description: 'test',
      skillsetId: '1',
    })

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('instruction'),
          type: 'warning',
        }),
      ])
    )
  })

  it('warns when skillsetId is missing', () => {
    const warnings = getAbilityWarnings({
      name: 'test',
      description: 'test',
      instruction: 'test',
    })

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('skillset'),
          type: 'warning',
        }),
      ])
    )
  })

  it('returns no warnings for fully populated data', () => {
    const warnings = getAbilityWarnings({
      name: 'test',
      description: 'test',
      instruction: 'do something',
      skillsetId: '1',
    })

    expect(warnings).toEqual([])
  })

  it('warns when template does not exist in abilityResources', () => {
    const abilityResources = {
      'platform/existing-template': { title: 'Existing' },
    }

    const warnings = getAbilityWarnings(
      {
        name: 'test',
        description: 'test',
        instruction: '@platform/non-existent-template',
        skillsetId: '1',
      },
      abilityResources
    )

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('does not exist'),
          type: 'warning',
        }),
      ])
    )
  })

  it('does not warn when template exists in abilityResources', () => {
    const abilityResources = {
      'platform/existing-template': { title: 'Existing' },
    }

    const warnings = getAbilityWarnings(
      {
        name: 'test',
        description: 'test',
        instruction: '@platform/existing-template',
        skillsetId: '1',
      },
      abilityResources
    )

    expect(warnings).toEqual([])
  })

  it('does not check template when abilityResources is not provided', () => {
    const warnings = getAbilityWarnings({
      name: 'test',
      description: 'test',
      instruction: '@platform/non-existent-template',
      skillsetId: '1',
    })

    expect(warnings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('does not exist'),
        }),
      ])
    )
  })

  it('warns for template instruction with parameters syntax', () => {
    const abilityResources = {
      'platform/real-template': { title: 'Real' },
    }

    const warnings = getAbilityWarnings(
      {
        name: 'test',
        description: 'test',
        instruction:
          'template: "@platform/missing-template"\nparameters:\n  key: value',
        skillsetId: '1',
      },
      abilityResources
    )

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: expect.stringContaining('does not exist'),
          type: 'warning',
        }),
      ])
    )
  })
})

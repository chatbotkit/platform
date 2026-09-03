import { GenericConfigurator } from './designer'

import { render, screen } from '@testing-library/react'

const setNodes = jest.fn()

jest.mock('@/prisma/client', () => ({}))
jest.mock('@/lib/toast', () => ({ success: jest.fn(), error: jest.fn() }))
jest.mock('@chatbotkit/react/hooks/useWidgetInstance', () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock('@chatbotkit/react/hooks/useWidgetInstanceFunctions', () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock('@/hooks/useDOMQuerySelector', () => ({
  __esModule: true,
  default: jest.fn(() => [document.body]),
}))
jest.mock('@/components/TooltipButton', () => ({
  __esModule: true,
  default: function TooltipButton({ caption, children, ...props }) {
    return <div {...props}>{caption || children}</div>
  },
}))
jest.mock('@/components/CopyButton', () => ({
  __esModule: true,
  default: function CopyButton({ children, ...props }) {
    return (
      <button type="button" {...props}>
        {children}
      </button>
    )
  },
  copyTextToClipboard: jest.fn(),
}))
jest.mock('@/components/SchemaPanel', () => {
  function MockSchemaPanelSaving({ setValue }) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setValue((currentValue) => {
              const nextValue = { ...currentValue }

              delete nextValue.description

              return nextValue
            })
          }}
        >
          remove description
        </button>
        <button
          type="button"
          onClick={() => {
            setValue({ name: 'Renamed' })
          }}
        >
          rename node
        </button>
        <button
          type="button"
          onClick={() => {
            setValue((currentValue) => currentValue)
          }}
        >
          noop update
        </button>
      </>
    )
  }

  return {
    __esModule: true,
    default: {
      Saving: MockSchemaPanelSaving,
    },
  }
})
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
    getNode: jest.fn(() => ({ position: { x: 0, y: 0 } })),
    setNodes,
    setEdges: jest.fn(),
    addNodes: jest.fn(),
    addEdges: jest.fn(),
    fitView: jest.fn(),
    screenToFlowPosition: jest.fn(),
    updateNode: jest.fn(),
    deleteElements: jest.fn(),
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

describe('GenericConfigurator', () => {
  beforeEach(() => {
    setNodes.mockClear()
  })

  it('shallow-merges function updater results into current node data', () => {
    render(
      <GenericConfigurator
        id="node-1"
        data={{ name: 'Probe', description: 'Keep me' }}
        schema={{
          name: { type: 'string', title: 'Name' },
          description: { type: 'string', title: 'Description' },
        }}
      />
    )

    screen.getByRole('button', { name: 'remove description' }).click()

    expect(setNodes).toHaveBeenCalledTimes(1)

    const updateNodes = setNodes.mock.calls[0][0]
    const nextNodes = updateNodes([
      {
        id: 'node-1',
        data: { name: 'Probe', description: 'Keep me' },
      },
    ])

    // @note merge semantics: omitted keys are preserved (description stays).
    // Deleting keys requires a different mechanism, see ContextInput.
    expect(nextNodes[0].data).toEqual({ name: 'Probe', description: 'Keep me' })
  })

  it('shallow-merges plain object updates so unrelated keys are preserved', () => {
    render(
      <GenericConfigurator
        id="node-1"
        data={{ name: 'Probe', description: 'Keep me' }}
        schema={{
          name: { type: 'string', title: 'Name' },
          description: { type: 'string', title: 'Description' },
        }}
      />
    )

    screen.getByRole('button', { name: 'rename node' }).click()

    expect(setNodes).toHaveBeenCalledTimes(1)

    const updateNodes = setNodes.mock.calls[0][0]
    const nextNodes = updateNodes([
      {
        id: 'node-1',
        data: { name: 'Probe', description: 'Keep me' },
      },
    ])

    expect(nextNodes[0].data).toEqual({ name: 'Renamed', description: 'Keep me' })
  })

  it('preserves node identity when a function updater returns the current data unchanged', () => {
    render(
      <GenericConfigurator
        id="node-1"
        data={{ name: 'Probe', description: 'Keep me' }}
        schema={{
          name: { type: 'string', title: 'Name' },
          description: { type: 'string', title: 'Description' },
        }}
      />
    )

    screen.getByRole('button', { name: 'noop update' }).click()

    expect(setNodes).toHaveBeenCalledTimes(1)

    const updateNodes = setNodes.mock.calls[0][0]
    const originalNode = {
      id: 'node-1',
      data: { name: 'Probe', description: 'Keep me' },
    }
    const originalNodes = [originalNode]

    expect(updateNodes(originalNodes)).toBe(originalNodes)
  })
})

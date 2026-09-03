import { shouldSkipCanvasKeyboardShortcut } from './designer'

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

describe('shouldSkipCanvasKeyboardShortcut', () => {
  it('skips shortcuts when focus is inside an input', () => {
    const activeElement = document.createElement('input')

    expect(
      shouldSkipCanvasKeyboardShortcut({
        activeElement,
      })
    ).toBe(true)
  })

  it('skips shortcuts when focus is inside a textarea', () => {
    const activeElement = document.createElement('textarea')

    expect(
      shouldSkipCanvasKeyboardShortcut({
        activeElement,
      })
    ).toBe(true)
  })

  it('skips shortcuts when focus is inside a contenteditable element', () => {
    const activeElement = document.createElement('div')

    activeElement.contentEditable = 'true'

    expect(
      shouldSkipCanvasKeyboardShortcut({
        activeElement,
      })
    ).toBe(true)
  })

  it('skips copy-style shortcuts when text is selected inside an editable container', () => {
    const editableElement = document.createElement('div')
    const textNode = document.createTextNode('selected text')

    editableElement.contentEditable = 'true'
    editableElement.appendChild(textNode)

    const selection = {
      toString: () => 'selected text',
      anchorNode: textNode,
    }

    expect(
      shouldSkipCanvasKeyboardShortcut({
        activeElement: document.body,
        selection,
        checkSelection: true,
      })
    ).toBe(true)
  })

  it('allows shortcuts for non-editable canvas targets', () => {
    const activeElement = document.createElement('div')

    expect(
      shouldSkipCanvasKeyboardShortcut({
        activeElement,
      })
    ).toBe(false)
  })
})

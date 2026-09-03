import { BaseBox, ResourceDnDProvider, ResourceItem } from './designer'

import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

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
jest.mock('@/components/DynamicIcon', () => {
  return function DynamicIcon(props) {
    const { fallbackIcon, ...rest } = props

    fallbackIcon

    return <div data-testid="dynamic-icon" {...rest} />
  }
})
jest.mock('@/components/TooltipButton', () => {
  return {
    __esModule: true,
    default: function TooltipButton({ caption, children, ...props }) {
      return <div {...props}>{caption || children}</div>
    },
  }
})
jest.mock('@/components/CopyButton', () => {
  return {
    __esModule: true,
    default: function CopyButton({ children, ...props }) {
      return (
        <button type="button" {...props}>
          {children}
        </button>
      )
    },
    copyTextToClipboard: jest.fn(),
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
    setNodes: jest.fn(),
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

describe('designer tag truncation', () => {
  it('renders resource item tags with shrinkable truncation classes', () => {
    render(
      <ResourceDnDProvider>
        <ResourceItem
          type="ability"
          tags={['very-long-resource-tag-that-should-truncate-cleanly']}
        >
          Long resource
        </ResourceItem>
      </ResourceDnDProvider>
    )

    expect(
      screen.getByText('very-long-resource-tag-that-should-truncate-cleanly')
    ).toHaveClass('min-w-0', 'max-w-full', 'shrink')
  })

  it('renders base box tags with shrinkable truncation classes', () => {
    render(
      <BaseBox
        id="secret-1"
        type="secret"
        title="Secret"
        width={280}
        height={200}
        data={{
          config: {
            template: 'platform/very-long-managed-template-name',
          },
        }}
      />
    )

    expect(screen.getByText('platform')).toHaveClass(
      'min-w-0',
      'max-w-full',
      'shrink'
    )
    expect(screen.getByText('secret')).toHaveClass(
      'min-w-0',
      'max-w-full',
      'shrink'
    )
  })
})

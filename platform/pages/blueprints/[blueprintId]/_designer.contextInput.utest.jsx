import { useState } from 'react'

import { ContextSchema } from '@/components/ContextInput'

import { DurationSelectFormatComponent, NameFormatComponent } from './designer'

import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

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
    const { fallbackIcon: _fallbackIcon, ...rest } = props

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

const schema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      title: 'Name',
      format: NameFormatComponent,
    },
  },
  required: ['name'],
}

const durationSchema = {
  type: 'object',
  properties: {
    sessionDuration: {
      type: ['number', 'null'],
      title: 'Session Duration',
      format: DurationSelectFormatComponent,
      maximum: 3600000,
      allowNoSession: false,
    },
  },
  required: ['sessionDuration'],
}

function DesignerNameHarness() {
  const [value, setValue] = useState({ name: 'first-node' })

  return (
    <>
      <ContextSchema schema={schema} value={value} setValue={setValue} />
      <output data-testid="designer-context-name">{value.name}</output>
      <button type="button" onClick={() => setValue({ name: 'second-node' })}>
        select second node
      </button>
    </>
  )
}

function DesignerDurationHarness() {
  const [value, setValue] = useState({ sessionDuration: null })

  return (
    <>
      <ContextSchema
        schema={durationSchema}
        value={value}
        setValue={setValue}
      />
      <output data-testid="designer-duration-value">
        {JSON.stringify(value)}
      </output>
    </>
  )
}

describe('designer ContextInput integration', () => {
  it('limits widget duration choices using the schema maximum', () => {
    render(<DesignerDurationHarness />)

    const labels = screen
      .getAllByRole('option')
      .map((option) => option.textContent)

    expect(labels).toEqual([
      '1 day (default)',
      '30 minutes',
      '45 minutes',
      '60 minutes',
    ])
  })

  it('stores a selected duration as a number', async () => {
    render(<DesignerDurationHarness />)

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '3600000' },
    })

    await waitFor(() => {
      expect(screen.getByTestId('designer-duration-value')).toHaveTextContent(
        '{"sessionDuration":3600000}'
      )
    })
  })

  it('updates mounted designer format fields when selected config value changes', async () => {
    render(<DesignerNameHarness />)

    expect(screen.getByDisplayValue('first-node')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'select second node' }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('second-node')).toBeInTheDocument()
    })

    expect(screen.getByTestId('designer-context-name')).toHaveTextContent(
      'second-node'
    )
  })

  it('keeps designer format edits flowing back into controlled schema value', async () => {
    render(<DesignerNameHarness />)

    fireEvent.change(screen.getByDisplayValue('first-node'), {
      target: { value: 'edited-node' },
    })

    await waitFor(() => {
      expect(screen.getByTestId('designer-context-name')).toHaveTextContent(
        'edited-node'
      )
    })
  })
})

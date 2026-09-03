import { parseTemplateInstruction } from '@/lib/instruction.template.parse'

import {
  getResourceReferenceEntries,
  remapInstructionParameterReferences,
  serializeBlueprintToText,
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

describe('serializeBlueprintToText', () => {
  it('serializes resource nodes into the resources section', () => {
    const nodes = [{ id: '#bot-1', type: 'bot', data: { name: 'My Bot' } }]
    const text = serializeBlueprintToText(nodes)

    expect(text).toContain('#bot-1')
    expect(text).toContain('bot')
    expect(text).toContain('My Bot')
  })

  it('places annotation nodes under the annotations section', () => {
    const nodes = [
      {
        id: '#note-1',
        type: 'note',
        data: { text: 'hello' },
        position: { x: 10, y: 20 },
        width: 200,
        height: 100,
      },
    ]
    const text = serializeBlueprintToText(nodes)

    expect(text).toContain('annotations')
    expect(text).toContain('#note-1')
    expect(text).not.toContain('\nresources:\n  #note-1')
  })

  it('places tool nodes under the tools section', () => {
    const nodes = [
      {
        id: '#tool-1',
        type: 'tool:code',
        data: {},
        position: { x: 0, y: 0 },
        width: 280,
        height: 200,
      },
    ]
    const text = serializeBlueprintToText(nodes)

    expect(text).toContain('tools')
    expect(text).toContain('#tool-1')
  })

  it('omits the annotations section when there are no annotation nodes', () => {
    const nodes = [{ id: '#bot-1', type: 'bot', data: {} }]
    const text = serializeBlueprintToText(nodes)

    expect(text).not.toContain('annotations')
  })

  it('omits the tools section when there are no tool nodes', () => {
    const nodes = [{ id: '#bot-1', type: 'bot', data: {} }]
    const text = serializeBlueprintToText(nodes)

    expect(text).not.toContain('tools')
  })

  it('handles an empty node list', () => {
    const text = serializeBlueprintToText([])

    expect(text).toContain('resources')
    expect(text).not.toContain('annotations')
    expect(text).not.toContain('tools')
  })

  it('serializes mixed node types into separate sections', () => {
    const nodes = [
      { id: '#bot-1', type: 'bot', data: { name: 'Bot' } },
      {
        id: '#note-1',
        type: 'note',
        data: { text: 'Note' },
        position: { x: 0, y: 0 },
        width: 200,
        height: 100,
      },
      {
        id: '#tool-1',
        type: 'tool:code',
        data: {},
        position: { x: 0, y: 0 },
        width: 280,
        height: 200,
      },
    ]
    const text = serializeBlueprintToText(nodes)

    expect(text).toContain('resources')
    expect(text).toContain('annotations')
    expect(text).toContain('tools')
  })
})

describe('instruction parameter references', () => {
  it('remaps resource ids embedded in ability template parameters', () => {
    const instruction = `template: cbk/file/read
params:
  fileId: '#file-old'
  note: keep this value`

    const result = remapInstructionParameterReferences(instruction, {
      '#file-old': '#file-new',
    })

    expect(parseTemplateInstruction(result).parameters).toEqual(
      expect.objectContaining({
        fileId: '#file-new',
        note: 'keep this value',
      })
    )
  })

  it('extracts graph references from ability template parameters', () => {
    const entries = getResourceReferenceEntries({
      instruction: `template: cbk/file/read
params:
  fileId: '#file-1'
  datasetId: '#dataset-1'
  note: keep this value`,
    })

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'fileId',
          value: '#file-1',
          sourceHandle: 'instruction:fileId',
          targetHandle: 'file',
        }),
        expect.objectContaining({
          key: 'datasetId',
          value: '#dataset-1',
          sourceHandle: 'instruction:datasetId',
          targetHandle: 'dataset',
        }),
      ])
    )
    expect(entries).toHaveLength(2)
  })
})

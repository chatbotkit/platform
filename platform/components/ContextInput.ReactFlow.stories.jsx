import '@xyflow/react/dist/style.css'

import { useMemo } from 'react'
import { createPortal } from 'react-dom'

import SchemaPanel, {
  SchemaPanelModeProvider,
  SchemaPanelPositionProvider,
} from '@/components/SchemaPanel'

import useDOMQuerySelector from '@/hooks/useDOMQuerySelector'

import { ContextSchema } from './ContextInput'

import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'

const meta = {
  title: 'Components/ContextInput/ReactFlow',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Stories that exercise the React Flow setNodes callback pattern used by blueprint configurators.',
      },
    },
  },
}

export default meta

const schema = {
  type: 'object',
  title: 'Selected Node Data',
  properties: {
    name: {
      type: 'string',
      title: 'Name',
    },
    description: {
      type: 'string',
      title: 'Description',
      'react:props': {
        placeholder: 'Type here quickly',
      },
    },
  },
  required: ['name'],
}

// @note mirror designer semantics: shallow-merge into current node.data so
// non-schema fields (e.g. selection metadata) are preserved.
function resolveFlowNodeData(currentData, incomingValue) {
  if (typeof incomingValue === 'function') {
    return {
      ...currentData,
      ...incomingValue(currentData),
    }
  }

  return {
    ...currentData,
    ...incomingValue,
  }
}

function updateFlowNodes(nodes, id, incomingValue) {
  let hasChanges = false

  const nextNodes = nodes.map((node) => {
    if (node.id !== id) {
      return node
    }

    const nextData = resolveFlowNodeData(node.data, incomingValue)

    if (Object.is(nextData, node.data)) {
      return node
    }

    hasChanges = true

    return {
      ...node,
      data: nextData,
    }
  })

  return hasChanges ? nextNodes : nodes
}

// ----------------------------------------------------------------------------
// Story 1: lightweight harness for ContextSchema + setNodes
// ----------------------------------------------------------------------------

function ControlledSchemaCanvas({ nodes, onNodesChange }) {
  const nodeTypes = useMemo(() => ({}), [])

  return (
    <div className="h-64 overflow-hidden rounded border border-gray-200 bg-white">
      <ReactFlow
        nodes={nodes}
        edges={[]}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
      </ReactFlow>
    </div>
  )
}

function ControlledSchemaHarness() {
  const [nodes, setNodes, onNodesChange] = useNodesState([
    {
      id: 'node-1',
      type: 'default',
      position: { x: 120, y: 80 },
      data: {
        name: '',
        description: 'Start typing in the form to update this node.',
      },
      selected: true,
    },
  ])

  const selectedNode = nodes.find((node) => node.id === 'node-1')

  const setValue = (value) => {
    setNodes((nodes) => {
      return updateFlowNodes(nodes, 'node-1', value)
    })
  }

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">
            React Flow Controlled Schema
          </h2>
          <p className="text-sm text-gray-600">
            This uses the same{' '}
            <code>setNodes((nodes) =&gt; nodes.map(...))</code> replace logic as
            the real configurators.
          </p>
        </div>

        <ControlledSchemaCanvas nodes={nodes} onNodesChange={onNodesChange} />

        <div className="flex flex-wrap gap-2">
          <button
            className="default-button"
            type="button"
            onClick={() => {
              setValue({ name: '', description: 'Reset from toolbar button.' })
            }}
          >
            Reset Node Data
          </button>
          <button
            className="default-button"
            type="button"
            onClick={() => {
              setValue((prev) => ({
                ...prev,
                name: '',
              }))

              setValue((prev) => ({
                ...prev,
                name: prev.name + 't',
              }))
              setValue((prev) => ({
                ...prev,
                name: prev.name + 'e',
              }))
              setValue((prev) => ({
                ...prev,
                name: prev.name + 's',
              }))
            }}
          >
            Run Burst Update
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded border border-gray-200 bg-gray-50 p-4">
          <ContextSchema
            schema={schema}
            value={selectedNode?.data}
            setValue={setValue}
          />
        </div>

        <div className="rounded border border-gray-200 bg-gray-50 p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Selected Node Data
          </div>
          <pre className="mt-2 overflow-auto text-sm">
            {JSON.stringify(selectedNode?.data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}

export function ControlledSchema() {
  return (
    <ReactFlowProvider>
      <ControlledSchemaHarness />
    </ReactFlowProvider>
  )
}

// ----------------------------------------------------------------------------
// Story 2: portal-mounted SchemaPanel.Saving probe (closest to designer)
// ----------------------------------------------------------------------------

function ProbeConfigurator({ id, data }) {
  const { setNodes } = useReactFlow()
  const [target] = useDOMQuerySelector('#configurator-probe-area', {
    waitForElements: true,
  })

  const setValue = (value) => {
    setNodes((nodes) => {
      return updateFlowNodes(nodes, id, value)
    })
  }

  return target
    ? createPortal(
        <SchemaPanel.Saving
          className="right-4 top-4"
          title={data.name || 'Probe node'}
          schema={schema}
          value={data}
          setValue={setValue}
        />,
        target
      )
    : null
}

function ProbeNode(props) {
  return (
    <>
      <div className="min-w-56 rounded-xl border-2 border-sky-400 bg-white p-4 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-sky-600">
          Selected Node
        </div>
        <div className="mt-2 text-sm font-semibold text-gray-900">
          {props.data.name || '(empty name)'}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {props.data.description || '(empty description)'}
        </div>
      </div>
      {props.selected ? (
        <ProbeConfigurator id={props.id} data={props.data} />
      ) : null}
    </>
  )
}

function ProbeCanvas() {
  const initialNodes = useMemo(
    () => [
      {
        id: 'probe-node',
        type: 'probe',
        position: { x: 80, y: 80 },
        data: {
          name: '',
          description: '',
        },
        selected: true,
      },
    ],
    []
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState([])

  const nodeTypes = useMemo(
    () => ({
      probe: ProbeNode,
    }),
    []
  )

  const liveNode = nodes[0]

  return (
    <div className="flex h-screen w-full bg-gray-100">
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          setNodes={setNodes}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
        </ReactFlow>
      </div>

      <div
        id="configurator-probe-area"
        className="relative h-full w-96 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50"
      >
        <div className="hidden only:block p-4 text-xs text-gray-400">
          Select a node to configure
        </div>
      </div>

      <div className="fixed bottom-4 left-4 z-50 w-[28rem] rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
        <div className="text-xs uppercase tracking-wide text-gray-500">
          Live Node Data
        </div>
        <pre className="mt-2 overflow-auto text-xs text-gray-900">
          {JSON.stringify(liveNode?.data, null, 2)}
        </pre>
      </div>
    </div>
  )
}

export function SelectedNodePortalConfigurator() {
  return (
    <SchemaPanelModeProvider storageKey="story:reactflow-configurator-probe-mode">
      <SchemaPanelPositionProvider>
        <ReactFlowProvider>
          <ProbeCanvas />
        </ReactFlowProvider>
      </SchemaPanelPositionProvider>
    </SchemaPanelModeProvider>
  )
}

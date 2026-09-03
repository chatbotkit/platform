'use client'

import '@xyflow/react/dist/style.css'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  LuArrowLeft,
  LuDownload,
  LuImagePlus,
  LuMap,
  LuMaximize2,
  LuRedo2,
  LuSave,
  LuUndo2,
  LuX,
} from 'react-icons/lu'

import { errorToErrorResponse } from '@/lib/error'
import { throwUnprocessableEntity } from '@/lib/response'
import { saveUrl } from '@/lib/save'
import toast from '@/lib/toast'

import { AppNavExtra } from '@/layouts/App'

import { useConfirmYesNo } from '@/components/Confirm'
import ImageModelSelect from '@/components/ImageModelSelect'

import useHistory from '@/hooks/useHistory'
import usePreventLeave from '@/hooks/usePreventLeave'
import useRouter from '@/hooks/useRouter'
import useTheme from '@/hooks/useTheme'

import { APP_NAME } from '../../const'
import { DEFAULT_MODEL, DEFAULT_SIZE, SIZES } from '../../lib'
import {
  createAssetUpload,
  editImageNode,
  generateImage,
  getAssetUrls,
  saveProject,
} from './server'

import {
  Background,
  ControlButton,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react'

import clsx from 'clsx'

/**
 * A round icon button matching the shape of the profile dropdown button. The
 * button style (e.g. `default-button` or `primary-button`) is supplied by the
 * caller via `buttonClassName`.
 */
function NavIconButton({
  icon: Icon,
  buttonClassName = 'default-button',
  ...props
}) {
  return (
    <button
      type="button"
      className={clsx(
        buttonClassName,
        'pointer-events-auto flex aspect-square size-9 items-center justify-center rounded-full p-0'
      )}
      {...props}
    >
      <Icon className="size-4" />
    </button>
  )
}

/**
 * Context that exposes node-level callbacks and editor metadata to the custom
 * ReactFlow node, which only otherwise receives its own `data`.
 */
const EditorContext = createContext({
  busy: false,
  dragging: false,
  endDrag: () => {},
  zoomImage: () => {},
  getSourceCount: () => 0,
  updateNodeData: () => {},
  removeNode: () => {},
  generateNode: () => {},
  setNodeImageFromFile: () => {},
})

/** Returns the first image file from a drag event's data transfer, if any. */
function imageFileFromEvent(event) {
  return Array.from(event.dataTransfer?.files || []).find((file) =>
    file.type?.startsWith('image/')
  )
}

/**
 * Builds the persisted graph payload (stripped of transient fields such as
 * `assetUrl`/`pendingLabel`). Used both when saving and to detect whether the
 * graph has unsaved changes.
 */
function buildGraphPayload(nodes, edges) {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: 'image',
      position: node.position,
      data: {
        prompt: node.data.prompt || '',
        model: node.data.model || DEFAULT_MODEL,
        size: node.data.size || DEFAULT_SIZE,
        assetPath: node.data.assetPath || null,
        status: node.data.status === 'pending' ? 'empty' : node.data.status,
        ...(node.data.error ? { error: node.data.error } : {}),
      },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  }
}

function uid() {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  return `id-${Date.now()}-${Math.random()}`
}

/** Creates a fresh, empty image node at the given position. */
function makeImageNode(position) {
  return {
    id: uid(),
    type: 'image',
    position,
    data: {
      prompt: '',
      model: DEFAULT_MODEL,
      size: DEFAULT_SIZE,
      assetPath: null,
      status: 'empty',
    },
  }
}

/** A single image node: prompt, model/size controls and the generated image. */
function ImageNode({ id, data }) {
  const {
    busy,
    dragging,
    endDrag,
    zoomImage,
    getSourceCount,
    updateNodeData,
    removeNode,
    generateNode,
    setNodeImageFromFile,
  } = useContext(EditorContext)

  const [hover, setHover] = useState(false)

  // @note the prompt is backed by synchronous local state so the caret is not
  // reset to the end on each keystroke - updating node data directly would feed
  // the value back through ReactFlow's async store a tick late
  const [prompt, setPrompt] = useState(data.prompt || '')

  useEffect(() => {
    setPrompt(data.prompt || '')
  }, [data.prompt])

  // @note only highlight while a drag is actually in progress, so the ring is
  // cleared if the drag ends outside the window or is cancelled with Escape
  const dropActive = dragging && hover

  const sourceCount = getSourceCount(id)

  const pending = data.status === 'pending'

  const onDragOver = (event) => {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) {
      return
    }

    // @note claim the drop so it does not bubble up to the canvas handler
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    setHover(true)
  }

  const onDragLeave = (event) => {
    event.stopPropagation()
    setHover(false)
  }

  const onDrop = (event) => {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    setHover(false)

    // @note stopPropagation prevents the window drop handler from firing, so
    // clear the global drag overlay explicitly here
    endDrag()

    const file = imageFileFromEvent(event)

    if (file) {
      setNodeImageFromFile(id, file)
    }
  }

  return (
    <div
      className={clsx(
        'rounded-xl p-[2px]',
        // @note an animated rotating gradient border signals active work
        pending
          ? 'bg-gradient-dynamic animate-deg-rotate from-pink-500 via-cyan-500 to-violet-500'
          : 'bg-transparent'
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        className={clsx(
          'w-72 rounded-[10px] border bg-white shadow-sm dark:bg-gray-900',
          dropActive
            ? 'border-indigo-500 ring-2 ring-indigo-500'
            : 'border-gray-200 dark:border-gray-700'
        )}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!z-20 !size-3 !border-2 !border-white !bg-indigo-500 dark:!border-gray-900"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="!z-20 !size-3 !border-2 !border-white !bg-indigo-500 dark:!border-gray-900"
        />

        {/* preview */}
        <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-t-[10px] bg-gray-100 dark:bg-gray-800">
          {data.assetUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.assetUrl}
              alt={data.prompt || 'Generated image'}
              className="h-full w-full select-none object-cover"
              draggable={false}
            />
          ) : (
            <span className="px-4 text-center text-sm text-gray-400">
              {pending
                ? data.pendingLabel || 'Generating…'
                : 'No image yet - drop one here'}
            </span>
          )}
          {data.assetUrl && !pending ? (
            <div className="absolute right-2 top-2 flex gap-1">
              <button
                type="button"
                className="nodrag flex size-7 items-center justify-center rounded-md bg-black/50 text-white transition-colors hover:bg-black/70"
                title="View fullscreen"
                aria-label="View fullscreen"
                onClick={(event) => {
                  event.stopPropagation()
                  zoomImage(data.assetUrl)
                }}
              >
                <LuMaximize2 className="size-4" />
              </button>
              <button
                type="button"
                className="nodrag flex size-7 items-center justify-center rounded-md bg-black/50 text-white transition-colors hover:bg-black/70"
                title="Download image"
                aria-label="Download image"
                onClick={(event) => {
                  event.stopPropagation()
                  saveUrl(data.assetUrl)
                }}
              >
                <LuDownload className="size-4" />
              </button>
            </div>
          ) : null}
          {pending ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/60">
              <span className="text-sm font-medium">
                {data.pendingLabel || 'Generating…'}
              </span>
            </div>
          ) : null}
        </div>

        {/* controls */}
        <div className="space-y-2 p-3">
          <textarea
            className="default-input nodrag w-full text-sm"
            rows={3}
            placeholder={
              sourceCount > 0
                ? 'How should the connected images be transformed?'
                : 'Describe the image to generate…'
            }
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value)
              updateNodeData(id, { prompt: event.target.value })
            }}
          />

          <div className="space-y-2">
            <ImageModelSelect
              wrapperClassName="nodrag"
              containerClassName="nodrag"
              className="default-input w-full cursor-pointer text-xs"
              value={data.model || DEFAULT_MODEL}
              setValue={(model) => updateNodeData(id, { model })}
              disabled={pending}
            />
            <select
              className="default-input nodrag w-full text-xs"
              value={data.size}
              onChange={(event) =>
                updateNodeData(id, { size: event.target.value })
              }
            >
              {SIZES.map((size) => (
                <option key={size} value={size}>
                  {size === 'auto' ? 'auto size' : size}
                </option>
              ))}
            </select>
          </div>

          {data.status === 'error' && data.error ? (
            <p className="text-xs text-red-500">{data.error}</p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              className="primary-button small nodrag min-w-0 flex-1"
              disabled={pending || busy || !data.prompt?.trim()}
              onClick={() => generateNode(id)}
            >
              {sourceCount > 0 ? 'Transform' : 'Generate'}
            </button>
            <button
              type="button"
              className="danger-button small nodrag shrink-0 whitespace-nowrap"
              disabled={pending}
              onClick={() => removeNode(id)}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The interactive canvas. Must be rendered inside a ReactFlowProvider. */
function Flow({ project, assetUrls }) {
  const projectId = project.id

  const router = useRouter()

  const { screenToFlowPosition, fitView } = useReactFlow()

  const confirmYesNo = useConfirmYesNo()

  const toRfNode = useCallback(
    (node) => ({
      id: node.id,
      type: 'image',
      position: node.position,
      data: {
        prompt: node.data.prompt || '',
        model: node.data.model || DEFAULT_MODEL,
        size: node.data.size || DEFAULT_SIZE,
        assetPath: node.data.assetPath || null,
        status: node.data.status || 'empty',
        error: node.data.error,
        assetUrl: node.data.assetPath
          ? assetUrls[node.data.assetPath]
          : undefined,
      },
    }),
    [assetUrls]
  )

  // @note deterministic initial graph (no random ids) so server and client
  // render identically; an empty project is seeded with a node after mount
  const [initialNodes] = useState(() => (project.nodes || []).map(toRfNode))

  const [nodes, setNodes, onNodesChangeOriginal] = useNodesState(initialNodes)

  const [edges, setEdges, onEdgesChangeOriginal] = useEdgesState(
    project.edges || []
  )

  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [paneDragActive, setPaneDragActive] = useState(false)
  const [minimap, setMinimap] = useState(true)
  const [lightboxUrl, setLightboxUrl] = useState(null)

  // @note snapshot of the last-saved graph; compared against the live graph to
  // surface unsaved changes
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify(buildGraphPayload(initialNodes, project.edges || []))
  )

  // @note an empty project opens with a single ready-to-use node so the canvas
  // is never blank. Done client-side (after hydration) to keep random ids out
  // of SSR, and folded into the saved snapshot so it is not flagged as unsaved.
  useEffect(() => {
    if (initialNodes.length > 0) {
      return
    }

    const seed = makeImageNode({ x: 0, y: 0 })

    setNodes([seed])
    setSavedSnapshot(
      JSON.stringify(buildGraphPayload([seed], project.edges || []))
    )

    requestAnimationFrame(() => fitView())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // @note sync ReactFlow's built-in color scheme with the app theme
  const { theme, resolvedTheme } = useTheme()
  const [colorMode, setColorMode] = useState('light')

  useEffect(() => {
    setColorMode((resolvedTheme || theme) === 'dark' ? 'dark' : 'light')
  }, [theme, resolvedTheme])

  // @note used to find the visible canvas centre when adding a node
  const flowWrapperRef = useRef(null)

  // @note keep a live ref to nodes/edges so callbacks can read the latest graph
  // without being re-created on every change
  const nodesRef = useRef(nodes)

  nodesRef.current = nodes

  const edgesRef = useRef(edges)

  edgesRef.current = edges

  // @note the graph has unsaved changes when it differs from the last save
  const dirty = useMemo(
    () => JSON.stringify(buildGraphPayload(nodes, edges)) !== savedSnapshot,
    [nodes, edges, savedSnapshot]
  )

  // @note warn on full page unloads (reload / close / external nav)
  usePreventLeave(dirty)

  // @note the in-app back button is a client navigation, which beforeunload
  // does not intercept, so confirm here explicitly
  const onBack = useCallback(async () => {
    if (
      dirty &&
      !(await confirmYesNo('You have unsaved changes. Leave without saving?'))
    ) {
      return
    }

    router.push(`/apps/${APP_NAME}`)
  }, [dirty, confirmYesNo, router])

  // --- undo / redo history ---------------------------------------------------

  const history = useHistory({ maxHistoryLength: 50 })

  // @note guards history capture while we are applying an undo/redo
  const isUndoRedoRef = useRef(false)

  // @note the latest committed graph, used as the snapshot to push on changes
  const lastStateRef = useRef({ nodes, edges })

  // @note state captured at the start of a node drag
  const preDragStateRef = useRef(null)

  useEffect(() => {
    if (!isUndoRedoRef.current) {
      lastStateRef.current = { nodes, edges }
    }
  }, [nodes, edges])

  // @note pushes the pre-mutation graph onto the history stack
  const pushHistory = useCallback(() => {
    if (isUndoRedoRef.current) {
      return
    }

    history.pushState({
      nodes: lastStateRef.current.nodes,
      edges: lastStateRef.current.edges,
    })
  }, [history])

  const onNodeDragStart = useCallback(() => {
    preDragStateRef.current = {
      nodes: lastStateRef.current.nodes,
      edges: lastStateRef.current.edges,
    }
  }, [])

  const onNodeDragStop = useCallback(() => {
    if (preDragStateRef.current && !isUndoRedoRef.current) {
      history.pushState(preDragStateRef.current)
      preDragStateRef.current = null
    }
  }, [history])

  // @note capture history for structural changes that flow through ReactFlow
  // (e.g. deleting a node/edge via the keyboard)
  const onNodesChange = useCallback(
    (changes) => {
      const structural = changes.some(
        (change) => change.type === 'remove' || change.type === 'add'
      )

      if (structural) {
        pushHistory()
      }

      onNodesChangeOriginal(changes)
    },
    [onNodesChangeOriginal, pushHistory]
  )

  const onEdgesChange = useCallback(
    (changes) => {
      const structural = changes.some(
        (change) => change.type === 'remove' || change.type === 'add'
      )

      if (structural) {
        pushHistory()
      }

      onEdgesChangeOriginal(changes)
    },
    [onEdgesChangeOriginal, pushHistory]
  )

  const undo = useCallback(() => {
    if (!history.canUndo) {
      return
    }

    isUndoRedoRef.current = true

    try {
      history.pushToFuture({
        nodes: lastStateRef.current.nodes,
        edges: lastStateRef.current.edges,
      })

      const previousState = history.undo()

      if (previousState) {
        setNodes(previousState.nodes)
        setEdges(previousState.edges)
        lastStateRef.current = previousState
      }
    } finally {
      isUndoRedoRef.current = false
    }
  }, [history, setNodes, setEdges])

  const redo = useCallback(() => {
    if (!history.canRedo) {
      return
    }

    isUndoRedoRef.current = true

    try {
      history.pushState({
        nodes: lastStateRef.current.nodes,
        edges: lastStateRef.current.edges,
      })

      const nextState = history.redo()

      if (nextState) {
        setNodes(nextState.nodes)
        setEdges(nextState.edges)
        lastStateRef.current = nextState
      }
    } finally {
      isUndoRedoRef.current = false
    }
  }, [history, setNodes, setEdges])

  const canUndo = history.canUndo
  const canRedo = history.canRedo

  // @note keyboard shortcuts (ignored while typing in a field)
  useEffect(() => {
    function handleKeyDown(event) {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== 'z'
      ) {
        return
      }

      const target = event.target

      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      event.preventDefault()

      if (event.shiftKey) {
        redo()
      } else {
        undo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  const updateNodeData = useCallback(
    (nodeId, patch) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...patch } }
            : node
        )
      )
    },
    [setNodes]
  )

  const removeNode = useCallback(
    (nodeId) => {
      pushHistory()
      setNodes((current) => current.filter((node) => node.id !== nodeId))
      setEdges((current) =>
        current.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId
        )
      )
    },
    [setNodes, setEdges, pushHistory]
  )

  const getSourceCount = useCallback(
    (nodeId) =>
      edgesRef.current.filter((edge) => edge.target === nodeId).length,
    []
  )

  const onConnect = useCallback(
    (connection) => {
      pushHistory()
      setEdges((current) => addEdge({ ...connection, id: uid() }, current))
    },
    [setEdges, pushHistory]
  )

  // @note approximate node dimensions (flow units) so we can offset the drop
  // point and land the node centred rather than top-left aligned
  const NODE_WIDTH = 288
  const NODE_HEIGHT = 380

  /** Returns the flow position that centres a node in the visible canvas. */
  const visibleCenterPosition = useCallback(() => {
    const wrapper = flowWrapperRef.current

    if (!wrapper) {
      return { x: 0, y: 0 }
    }

    const rect = wrapper.getBoundingClientRect()

    const center = screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })

    return {
      x: center.x - NODE_WIDTH / 2,
      y: center.y - NODE_HEIGHT / 2,
    }
  }, [screenToFlowPosition])

  /**
   * When a connection is dragged from a handle and released over empty canvas
   * (not another node), create a new empty node there and wire it to the
   * originating handle.
   */
  const onConnectEnd = useCallback(
    (event, connectionState) => {
      // @note a valid drop means it landed on a handle - nothing to create
      if (connectionState.isValid || !connectionState.fromNode) {
        return
      }

      const point = 'changedTouches' in event ? event.changedTouches[0] : event

      const dropped = screenToFlowPosition({
        x: point.clientX,
        y: point.clientY,
      })

      const node = makeImageNode({
        x: dropped.x,
        y: dropped.y - NODE_HEIGHT / 2,
      })

      pushHistory()

      setNodes((current) => [...current, node])

      // @note respect the drag direction: dragging from a target handle means
      // the new node feeds into the origin, otherwise the origin feeds the new
      const fromId = connectionState.fromNode.id

      const edge =
        connectionState.fromHandle?.type === 'target'
          ? { id: uid(), source: node.id, target: fromId }
          : { id: uid(), source: fromId, target: node.id }

      setEdges((current) => addEdge(edge, current))
    },
    [screenToFlowPosition, setNodes, setEdges, pushHistory]
  )

  const onAddNode = useCallback(() => {
    pushHistory()
    setNodes((current) => [...current, makeImageNode(visibleCenterPosition())])
  }, [setNodes, visibleCenterPosition, pushHistory])

  /** Serializes the current graph (without transient fields) and persists it. */
  const persist = useCallback(async () => {
    const payload = buildGraphPayload(nodesRef.current, edgesRef.current)

    const result = await saveProject({
      projectId,
      nodes: payload.nodes,
      edges: payload.edges,
    })

    if (!result) {
      return throwUnprocessableEntity('Unexpected action result')
    }

    if ('error' in result) {
      throw errorToErrorResponse(result.error)
    }

    // @note remember what we saved so the unsaved-changes indicator clears
    setSavedSnapshot(JSON.stringify(payload))
  }, [projectId])

  const onSave = useCallback(async () => {
    setSaving(true)

    const toastId = toast.loading('Saving…', {})

    try {
      await persist()

      toast.success('Saved!', { id: toastId })
    } catch (e) {
      toast.error(e.message, { id: toastId })
    } finally {
      setSaving(false)
    }
  }, [persist])

  const generateNode = useCallback(
    async (nodeId) => {
      const node = nodesRef.current.find((item) => item.id === nodeId)

      if (!node || !node.data.prompt?.trim()) {
        return
      }

      // @note source images are the ready assets of nodes feeding into this one
      const sourceAssetPaths = edgesRef.current
        .filter((edge) => edge.target === nodeId)
        .map((edge) => nodesRef.current.find((item) => item.id === edge.source))
        .map((source) => source?.data.assetPath)
        .filter(Boolean)

      const activity =
        sourceAssetPaths.length > 0 ? 'Transforming…' : 'Generating…'

      // @note capture pre-generation state so the result can be undone
      pushHistory()

      updateNodeData(nodeId, {
        status: 'pending',
        pendingLabel: activity,
        error: undefined,
      })
      setBusy(true)

      const toastId = toast.loading(activity, {})

      try {
        const result =
          sourceAssetPaths.length > 0
            ? await editImageNode({
                projectId,
                prompt: node.data.prompt,
                sourceAssetPaths,
                model: node.data.model,
                size: node.data.size,
              })
            : await generateImage({
                projectId,
                prompt: node.data.prompt,
                model: node.data.model,
                size: node.data.size,
              })

        if (!result) {
          return throwUnprocessableEntity('Unexpected action result')
        }

        if ('error' in result) {
          throw errorToErrorResponse(result.error)
        }

        updateNodeData(nodeId, {
          assetPath: result.assetPath,
          assetUrl: result.assetUrl,
          status: 'ready',
          pendingLabel: undefined,
          error: undefined,
        })

        toast.success('Done!', { id: toastId })

        // @note persist so the new asset reference survives a reload
        await persist()
      } catch (e) {
        updateNodeData(nodeId, { status: 'error', error: e.message })

        toast.error(e.message, { id: toastId })
      } finally {
        setBusy(false)
      }
    },
    [projectId, updateNodeData, persist, pushHistory]
  )

  /**
   * Uploads a local file to the project's assets folder via a presigned PUT
   * (the bytes go straight to storage) and returns its path and display URL.
   */
  const uploadFile = useCallback(
    async (file) => {
      const meta = await createAssetUpload({
        projectId,
        file: { type: file.type, size: file.size },
      })

      if (!meta) {
        return throwUnprocessableEntity('Unexpected action result')
      }

      if ('error' in meta) {
        throw errorToErrorResponse(meta.error)
      }

      if (!meta.uploadRequest) {
        throw new Error('Upload is not available')
      }

      const { method, url, headers } = meta.uploadRequest

      const response = await window.fetch(url, {
        method,
        headers: headers ?? {},
        body: await file.arrayBuffer(),
      })

      if (!response.ok) {
        throw new Error('Failed to upload image')
      }

      const urls = await getAssetUrls({ projectId, paths: [meta.path] })

      const assetUrl =
        urls && !('error' in urls) ? urls.assetUrls[meta.path] : undefined

      return { assetPath: meta.path, assetUrl }
    },
    [projectId]
  )

  /** Creates a new node from a dropped image file at the given flow position. */
  const addNodeFromFile = useCallback(
    async (file, position) => {
      if (!file?.type?.startsWith('image/')) {
        toast.error('Only image files are supported')

        return
      }

      const nodeId = uid()

      pushHistory()
      setNodes((current) => [
        ...current,
        {
          id: nodeId,
          type: 'image',
          position,
          data: {
            prompt: '',
            model: DEFAULT_MODEL,
            size: DEFAULT_SIZE,
            assetPath: null,
            status: 'pending',
            pendingLabel: 'Uploading…',
          },
        },
      ])

      setBusy(true)

      const toastId = toast.loading('Uploading image…', {})

      try {
        const { assetPath, assetUrl } = await uploadFile(file)

        updateNodeData(nodeId, {
          assetPath,
          assetUrl,
          status: 'ready',
          pendingLabel: undefined,
        })

        toast.success('Image added!', { id: toastId })

        await persist()
      } catch (e) {
        setNodes((current) => current.filter((node) => node.id !== nodeId))

        toast.error(e.message, { id: toastId })
      } finally {
        setBusy(false)
      }
    },
    [setNodes, uploadFile, updateNodeData, persist, pushHistory]
  )

  /** Replaces an existing node's image with a dropped image file. */
  const setNodeImageFromFile = useCallback(
    async (nodeId, file) => {
      if (!file?.type?.startsWith('image/')) {
        toast.error('Only image files are supported')

        return
      }

      pushHistory()
      updateNodeData(nodeId, {
        status: 'pending',
        pendingLabel: 'Uploading…',
        error: undefined,
      })
      setBusy(true)

      const toastId = toast.loading('Uploading image…', {})

      try {
        const { assetPath, assetUrl } = await uploadFile(file)

        updateNodeData(nodeId, {
          assetPath,
          assetUrl,
          status: 'ready',
          pendingLabel: undefined,
          error: undefined,
        })

        toast.success('Image set!', { id: toastId })

        await persist()
      } catch (e) {
        updateNodeData(nodeId, { status: 'error', error: e.message })

        toast.error(e.message, { id: toastId })
      } finally {
        setBusy(false)
      }
    },
    [updateNodeData, uploadFile, persist, pushHistory]
  )

  const onPaneDragOver = useCallback((event) => {
    if (!Array.from(event.dataTransfer?.types || []).includes('Files')) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }, [])

  const onPaneDrop = useCallback(
    (event) => {
      const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
        file.type?.startsWith('image/')
      )

      event.preventDefault()
      setPaneDragActive(false)

      if (!files.length) {
        return
      }

      const base = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      // @note stagger multiple drops so the new nodes do not fully overlap
      files.forEach((file, index) =>
        addNodeFromFile(file, {
          x: base.x + index * 40,
          y: base.y + index * 40,
        })
      )
    },
    [screenToFlowPosition, addNodeFromFile]
  )

  // @note pasting a copied image creates a node at the visible canvas centre
  useEffect(() => {
    function handlePaste(event) {
      const target = event.target

      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }

      const files = Array.from(event.clipboardData?.items || [])
        .filter(
          (item) => item.kind === 'file' && item.type.startsWith('image/')
        )
        .map((item) => item.getAsFile())
        .filter(Boolean)

      if (!files.length) {
        return
      }

      event.preventDefault()

      const base = visibleCenterPosition()

      files.forEach((file, index) =>
        addNodeFromFile(file, {
          x: base.x + index * 40,
          y: base.y + index * 40,
        })
      )
    }

    window.addEventListener('paste', handlePaste)

    return () => window.removeEventListener('paste', handlePaste)
  }, [addNodeFromFile, visibleCenterPosition])

  // @note track the file-drag state at the window level so the canvas hint is
  // reliably cleared when the drag ends anywhere - including dropping outside
  // the window or cancelling with Escape (cases where no drop/dragleave fires
  // on the pane)
  useEffect(() => {
    function hasFiles(event) {
      return Array.from(event.dataTransfer?.types || []).includes('Files')
    }

    function onWindowDragOver(event) {
      if (!hasFiles(event)) {
        return
      }

      // @note allow dropping and stop the browser from opening the file
      event.preventDefault()
      setPaneDragActive(true)
    }

    function onWindowDragLeave(event) {
      // @note relatedTarget is null once the cursor leaves the window
      if (!event.relatedTarget) {
        setPaneDragActive(false)
      }
    }

    function onWindowDrop(event) {
      event.preventDefault()
      setPaneDragActive(false)
    }

    function onWindowDragEnd() {
      setPaneDragActive(false)
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setPaneDragActive(false)
      }
    }

    window.addEventListener('dragover', onWindowDragOver)
    window.addEventListener('dragleave', onWindowDragLeave)
    window.addEventListener('drop', onWindowDrop)
    window.addEventListener('dragend', onWindowDragEnd)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('dragover', onWindowDragOver)
      window.removeEventListener('dragleave', onWindowDragLeave)
      window.removeEventListener('drop', onWindowDrop)
      window.removeEventListener('dragend', onWindowDragEnd)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const nodeTypes = useMemo(() => ({ image: ImageNode }), [])

  const endDrag = useCallback(() => setPaneDragActive(false), [])

  const zoomImage = useCallback((url) => setLightboxUrl(url), [])

  // @note close the fullscreen viewer with Escape
  useEffect(() => {
    if (!lightboxUrl) {
      return
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setLightboxUrl(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lightboxUrl])

  const contextValue = useMemo(
    () => ({
      busy,
      dragging: paneDragActive,
      endDrag,
      zoomImage,
      getSourceCount,
      updateNodeData,
      removeNode,
      generateNode,
      setNodeImageFromFile,
    }),
    [
      busy,
      paneDragActive,
      endDrag,
      zoomImage,
      getSourceCount,
      updateNodeData,
      removeNode,
      generateNode,
      setNodeImageFromFile,
    ]
  )

  return (
    <EditorContext.Provider value={contextValue}>
      {/* buttons next to the profile dropdown (top right) */}
      <AppNavExtra>
        <NavIconButton
          icon={LuImagePlus}
          onClick={onAddNode}
          title="Add image"
          aria-label="Add image"
        />
        <NavIconButton
          icon={LuSave}
          buttonClassName={dirty ? 'primary-button' : 'default-button'}
          onClick={onSave}
          disabled={saving || !dirty}
          title={dirty ? 'Save changes' : 'All changes saved'}
          aria-label="Save"
        />
      </AppNavExtra>

      {/* back button + project name + save state (top left) */}
      <div className="pointer-events-none fixed left-0 top-0 z-30 flex h-14 items-center gap-3 px-3">
        <NavIconButton
          icon={LuArrowLeft}
          onClick={onBack}
          title="Back to projects"
          aria-label="Back to projects"
        />
        <div className="flex min-w-0 flex-col">
          <span className="pointer-events-none max-w-[40vw] truncate text-sm font-medium">
            {project.name}
          </span>
          <span
            className={clsx(
              'pointer-events-none text-xs',
              saving
                ? 'text-gray-500 dark:text-gray-400'
                : dirty
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-gray-400 dark:text-gray-500'
            )}
          >
            {saving
              ? 'Saving…'
              : dirty
                ? 'Unsaved changes'
                : 'All changes saved'}
          </span>
        </div>
      </div>

      <div
        ref={flowWrapperRef}
        className="relative h-full w-full"
        onDragOver={onPaneDragOver}
        onDrop={onPaneDrop}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          colorMode={colorMode}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} position="bottom-left">
            <ControlButton
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl/⌘+Z)"
              style={{ opacity: canUndo ? 1 : 0.4 }}
            >
              <LuUndo2 style={{ fill: 'none', stroke: 'currentColor' }} />
            </ControlButton>
            <ControlButton
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl/⌘+Shift+Z)"
              style={{ opacity: canRedo ? 1 : 0.4 }}
            >
              <LuRedo2 style={{ fill: 'none', stroke: 'currentColor' }} />
            </ControlButton>
            <ControlButton
              onClick={() => setMinimap((value) => !value)}
              title={minimap ? 'Hide minimap' : 'Show minimap'}
            >
              <LuMap style={{ fill: 'none', stroke: 'currentColor' }} />
            </ControlButton>
          </Controls>
          {minimap ? (
            <MiniMap position="bottom-right" pannable zoomable />
          ) : null}
        </ReactFlow>
        {paneDragActive ? (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-start justify-center rounded-lg border-2 border-dashed border-indigo-500">
            <span className="mt-4 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white shadow-lg">
              Drop on the canvas to add - or onto a node to replace its image
            </span>
          </div>
        ) : null}
      </div>

      {/* fullscreen image viewer */}
      {lightboxUrl ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            title="Close"
            aria-label="Close"
            onClick={() => setLightboxUrl(null)}
          >
            <LuX className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </EditorContext.Provider>
  )
}

export function Editor({ project, assetUrls }) {
  return (
    <div className="h-screen w-full overflow-hidden">
      <ReactFlowProvider>
        <Flow project={project} assetUrls={assetUrls} />
      </ReactFlowProvider>
    </div>
  )
}

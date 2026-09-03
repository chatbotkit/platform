import '@xyflow/react/dist/style.css'

import { useEffect, useMemo, useState } from 'react'
import { MdZoomInMap, MdZoomOutMap } from 'react-icons/md'

import Portal from '@/components/Portal'

import useControlledState from '@/hooks/useControlledState'
import useTheme from '@/hooks/useTheme'

import useWidgetInstance from '@chatbotkit/react/hooks/useWidgetInstance'
import {
  Background,
  ControlButton,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react'

import clsx from 'clsx'

export function WidgetType() {
  return (
    <div
      id="theme-canvas-main-node"
      className="nodrag nopan nowheel w-full h-full flex flex-col justify-center items-center [&>*]:flex-1 [&>*]:w-full [&>*]:h-full"
    />
  )
}

WidgetType.dimensions = {
  width: 420,
  height: 860,
}

/**
 *
 */
export const nodeTypes = {
  widget: WidgetType,
}

/**
 *
 */
export const edgeTypes = {}

/**
 *
 */
export const proOptions = {
  hideAttribution: true,
}

export function ThemeGraph({
  className,

  defaultFullscreen: _defaultFullscreen = false,
  fullscreen: _fullscreen,
  setFullscreen: _setFullscreen,

  fullscreenToggle = true,

  ...props
}) {
  const [fullscreen, setFullscreen] = useControlledState(
    _defaultFullscreen,
    _fullscreen,
    _setFullscreen
  )

  const instance = useWidgetInstance('chatbotkit-widget')

  useEffect(() => {
    if (!instance) {
      return
    }

    if (fullscreen) {
      instance.hide()
    } else {
      instance.show()
    }
  }, [fullscreen, instance])

  const nodes = useMemo(() => {
    return [
      {
        id: 'widget',
        type: 'widget',
        position: { x: 0, y: 0 },
        width: WidgetType.dimensions.width,
        height: WidgetType.dimensions.height,
      },
    ]
  }, [])

  const edges = useMemo(() => {
    return []
  }, [])

  const reactFlow = useReactFlow()

  useEffect(() => {
    if (!reactFlow) {
      return
    }

    setTimeout(() => {
      const node = reactFlow.getNode('widget')

      if (node) {
        const nodeX = node.position.x + node.width / 2 || 0
        const nodeY = node.position.y + node.height / 2 || 0

        reactFlow.setCenter(nodeX, nodeY, { zoom: 0.8 })
      }
    }, 100)
  }, [reactFlow])

  useEffect(() => {
    setTimeout(() => {
      const node = reactFlow.getNode('widget')

      if (node) {
        const nodeX = node.position.x + node.width / 2 || 0
        const nodeY = node.position.y + node.height / 2 || 0

        reactFlow.setCenter(nodeX, nodeY, { zoom: 0.8, duration: 200 })
      }
    }, 100)
  }, [fullscreen, reactFlow])

  const { theme } = useTheme()

  const [colorMode, setColorMode] = useState()

  useEffect(() => {
    setColorMode(theme === 'dark' ? 'dark' : 'light')
  }, [theme])

  return (
    <div
      {...props}
      className={clsx(className, {
        'fixed top-0 left-0 w-full h-full z-20 bg-white dark:bg-black':
          fullscreen,
      })}
    >
      <ReactFlow
        // options
        proOptions={proOptions}
        // types
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        // nodes
        nodes={nodes}
        // edges
        edges={edges}
        // theme
        colorMode={colorMode}
      >
        <Background
          className="auto-bg-white"
          patternClassName="auto-bg-gray-50"
        />
        <Controls position="bottom-right">
          {fullscreenToggle ? (
            <ControlButton onClick={() => setFullscreen((prev) => !prev)}>
              {fullscreen ? <MdZoomInMap /> : <MdZoomOutMap />}
            </ControlButton>
          ) : null}
        </Controls>
      </ReactFlow>
    </div>
  )
}

export default function ThemeCanvas({
  className,

  defaultFullscreen,
  fullscreen,
  setFullscreen,

  fullscreenToggle = true,

  children,

  ...props
}) {
  return (
    <div
      {...props}
      className={clsx(
        'theme-canvas',
        'flex flex-row',
        'relative overflow-hidden',
        className
      )}
    >
      <Portal query="#theme-canvas-main-node">{children}</Portal>
      <ReactFlowProvider>
        <ThemeGraph
          className="w-full h-full"
          defaultFullscreen={defaultFullscreen}
          fullscreen={fullscreen}
          setFullscreen={setFullscreen}
          fullscreenToggle={fullscreenToggle}
        />
      </ReactFlowProvider>
    </div>
  )
}

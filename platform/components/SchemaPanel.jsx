import {
  cloneElement,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import Draggable from 'react-draggable'
import { TiPin, TiPinOutline } from 'react-icons/ti'

import { ContextSchema } from '@/components/ContextInput'
import Nbsp from '@/components/Nbsp'

import clsx from 'clsx'

export const SchemaPanelPositionContext = createContext(null)

/**
 * @note Tracks the configurator display mode: 'floating' (draggable overlay)
 *   or 'docked' (fixed right-side panel that pushes content). Persists the
 *   user's preference in localStorage. Initializes as 'floating' on the server
 *   to avoid hydration mismatch, then syncs from storage after mount.
 */
export const SchemaPanelModeContext = createContext({
  mode: 'floating',
  toggleMode: () => {},
})

export function SchemaPanelModeProvider({ storageKey, children }) {
  const key = storageKey || 'schema-panel:mode'

  const [mode, setMode] = useState('floating')

  // @note sync from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)

      if (stored) {
        const parsed = JSON.parse(stored)

        if (parsed === 'floating' || parsed === 'docked') {
          setMode(parsed)
        }
      }
    } catch {
      // @note storage may be unavailable
    }
  }, [key])

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'floating' ? 'docked' : 'floating'

      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // @note storage may be full or blocked
      }

      return next
    })
  }, [key])

  return (
    <SchemaPanelModeContext.Provider value={{ mode, toggleMode }}>
      {children}
    </SchemaPanelModeContext.Provider>
  )
}

export function useSchemaPanelMode() {
  return useContext(SchemaPanelModeContext)
}

export function SchemaPanelPositionProvider({ children }) {
  const positionRef = useRef({ x: 0, y: 0 })

  return (
    <SchemaPanelPositionContext.Provider value={positionRef.current}>
      {children}
    </SchemaPanelPositionContext.Provider>
  )
}

export function useSchemaPanelPositionProps() {
  const fallbackPositionRef = useRef({ x: 0, y: 0 })

  const defaultPosition =
    useContext(SchemaPanelPositionContext) || fallbackPositionRef.current

  return {
    defaultPosition,
    onDrag: useCallback(
      (_, ui) => {
        defaultPosition.x = ui.x
        defaultPosition.y = ui.y
      },
      [defaultPosition]
    ),
  }
}

export function Drag({ bounds = 'html', children, ...props }) {
  const nodeRef = useRef(null)

  return (
    <Draggable
      {...props}
      nodeRef={nodeRef}
      handle=".drag-handle"
      bounds={bounds}
    >
      {cloneElement(children, { ref: nodeRef })}
    </Draggable>
  )
}

Drag.Saving = function Saving(props) {
  const positionProps = useSchemaPanelPositionProps()

  return <Drag {...props} {...positionProps} />
}

export const Panel = forwardRef(function Panel(
  {
    className,

    title,

    dockable = true,

    children,

    ...props
  },
  ref
) {
  const { mode, toggleMode } = useSchemaPanelMode()

  const isDocked = dockable && mode === 'docked'

  // @note in docked mode, strip fixed-position classes (e.g. right-4 top-20)
  //   that are only meaningful for the floating overlay
  const resolvedClassName = isDocked ? undefined : className

  return (
    <div
      ref={ref}
      {...props}
      className={clsx(
        'pointer-events-auto',
        isDocked ? 'relative' : 'fixed z-50',
        'bg-gray-50 dark:bg-gray-950',
        isDocked ? '' : 'border-2 border-gray-500 dark:border-gray-800',
        isDocked ? 'overflow-auto' : 'rounded-xl overflow-auto',
        isDocked ? '' : 'shadow-xl',
        isDocked ? 'w-full h-full' : 'w-full max-w-md',
        resolvedClassName
      )}
    >
      <div
        className={clsx(
          'drag-handle',
          'w-full',
          'p-2',
          'min-h-10',
          'border-b border-gray-200 dark:border-gray-800',
          'text-xs font-semibold',
          isDocked ? 'cursor-default' : 'cursor-move',
          'bg-gray-100 dark:bg-gray-900',
          'flex items-center'
        )}
      >
        <span className="flex-1 truncate text-center">{title || <Nbsp />}</span>
        {dockable ? (
          <button
            type="button"
            onClick={toggleMode}
            className={clsx(
              'flex-shrink-0 w-4 h-4',
              'hover:bg-gray-200 dark:hover:bg-gray-800',
              'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
              'transition-colors'
            )}
            title={isDocked ? 'Undock panel' : 'Dock panel to side'}
          >
            {isDocked ? (
              <TiPin className="w-full h-full" />
            ) : (
              <TiPinOutline className="w-full h-full" />
            )}
          </button>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  )
})

export function Schema({
  className,
  inputClassName,

  schema,

  children,

  ...props
}) {
  return (
    <ContextSchema.Memo
      {...props}
      className={clsx(
        'm-2',
        'font-mono',
        '[&_.item-header]:w-24 [&_label]:text-xxs [&_label]:truncate',
        className
      )}
      inputClassName={clsx('default-input tiny !text-xxs', inputClassName)}
      labelTooltipButton
      schema={schema}
    >
      {children}
    </ContextSchema.Memo>
  )
}

export default function SchemaPanel({
  className,
  inputClassName,

  title,

  dockable = true,

  schema,

  defaultValue,
  value,
  setValue,

  children,

  ...props
}) {
  const { mode } = useSchemaPanelMode()
  const isDocked = dockable && mode === 'docked'

  const content = (
    <Panel className={className} title={title} dockable={dockable}>
      <Schema
        inputClassName={inputClassName}
        schema={schema}
        defaultValue={defaultValue}
        value={value}
        setValue={setValue}
      >
        {children}
      </Schema>
    </Panel>
  )

  // @note in docked mode, skip Draggable wrapper entirely
  if (isDocked) {
    return content
  }

  return <Drag {...props}>{content}</Drag>
}

SchemaPanel.Saving = function Saving(props) {
  const { mode } = useSchemaPanelMode()

  const isDocked = (props.dockable ?? true) && mode === 'docked'

  const positionProps = useSchemaPanelPositionProps()

  // @note in docked mode, skip position saving since panel is static
  if (isDocked) {
    return <SchemaPanel {...props} />
  }

  return <SchemaPanel {...props} {...positionProps} />
}

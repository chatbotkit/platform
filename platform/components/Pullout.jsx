import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useListen } from '@/hooks/useBus'
import useLocalStorage from '@/hooks/useLocalStorage'

import { Bars2Icon } from '@heroicons/react/20/solid'

import clsx from 'clsx'

// @note every pullout docks its handle bar over the bottom edge of the
// viewport, so the height of the tallest mounted handle bar is published as
// --pullout-inset-bottom on the root element. Layouts with fixed-height
// surfaces consume the variable with a 0px fallback to stay clear of the
// dock without re-deriving whether a pullout is on screen - see the sidebar
// in layouts/Dashboard.jsx.

const bottomInsets = new Map()

function applyBottomInsets() {
  const inset = Math.max(0, ...bottomInsets.values())

  if (inset > 0) {
    document.documentElement.style.setProperty(
      '--pullout-inset-bottom',
      `${inset}px`
    )
  } else {
    document.documentElement.style.removeProperty('--pullout-inset-bottom')
  }
}

export default function Pullout({
  id,

  keydownKey,

  openChannel,

  lockScroll,

  enableHandleHintAnimation = true,

  handleAriaLabel = 'Toggle pullout',

  handleContent,

  handleSemantics = true,

  enableResize = false,

  resizeStorageKey,

  defaultHeight = 640,

  minHeight = 320,

  className,

  children,

  ...props
}) {
  const [closed, setClosed] = useState(true)

  const resizeKey = useMemo(() => {
    return (
      resizeStorageKey || `pullout:${id || openChannel || 'default'}:height`
    )
  }, [resizeStorageKey, id, openChannel])

  const [storedHeight, setStoredHeight] = useLocalStorage(
    resizeKey,
    defaultHeight
  )

  const [hintPhase, setHintPhase] = useState(
    enableHandleHintAnimation ? 'hidden' : 'idle'
  )

  const [isResizing, setIsResizing] = useState(false)

  const resizeStateRef = useRef({
    active: false,
  })

  const handleBarRef = useRef(null)

  useEffect(() => {
    const handleBar = handleBarRef.current

    if (!handleBar) {
      return undefined
    }

    const measure = () => {
      bottomInsets.set(handleBar, handleBar.offsetHeight)

      applyBottomInsets()
    }

    measure()

    const release = () => {
      bottomInsets.delete(handleBar)

      applyBottomInsets()
    }

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(measure)

      observer.observe(handleBar)

      return () => {
        observer.disconnect()

        release()
      }
    }

    return release
  }, [])

  const clampHeight = useCallback(
    (height) => {
      if (typeof window === 'undefined') {
        return Math.max(height, minHeight)
      }

      const maxHeight = Math.min(window.innerHeight - 80, 1300)

      return Math.min(Math.max(height, minHeight), maxHeight)
    },
    [minHeight]
  )

  const contentHeight = closed ? 0 : clampHeight(storedHeight)

  useEffect(() => {
    if (!enableHandleHintAnimation) {
      setHintPhase('idle')

      return
    }

    const timers = [
      setTimeout(() => setHintPhase('revealed'), 80),
      setTimeout(() => setHintPhase('expanded'), 260),
      setTimeout(() => setHintPhase('settled'), 720),
      setTimeout(() => setHintPhase('idle'), 1180),
    ]

    return () => {
      timers.forEach((timer) => clearTimeout(timer))
    }
  }, [enableHandleHintAnimation])

  useListen(openChannel, () => {
    setClosed(false)
  })

  useEffect(() => {
    if (!keydownKey) {
      return
    }

    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === keydownKey) {
        event.preventDefault()

        setClosed(!closed)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [keydownKey, closed, setClosed])

  useEffect(() => {
    if (!lockScroll) {
      return
    }

    if (closed) {
      document.body.style.overflow = ''
    } else {
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [lockScroll, closed])

  useEffect(() => {
    if (closed || !enableResize) {
      return
    }

    const nextHeight = clampHeight(storedHeight)

    if (nextHeight !== storedHeight) {
      setStoredHeight(nextHeight)
    }
  }, [closed, enableResize, clampHeight, storedHeight, setStoredHeight])

  useEffect(() => {
    if (!enableResize) {
      return
    }

    const handleWindowResize = () => {
      setStoredHeight((currentHeight) => clampHeight(currentHeight))
    }

    window.addEventListener('resize', handleWindowResize)

    return () => {
      window.removeEventListener('resize', handleWindowResize)
    }
  }, [enableResize, clampHeight, setStoredHeight])

  useEffect(() => {
    return () => {
      resizeStateRef.current.active = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [])

  const stopResize = useCallback(() => {
    resizeStateRef.current.active = false
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    setIsResizing(false)
  }, [])

  const handleResizePointerDown = useCallback(
    (event) => {
      if (!enableResize || closed) {
        return
      }

      event.preventDefault()

      resizeStateRef.current.active = true
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'ns-resize'
      setIsResizing(true)

      const handlePointerMove = (moveEvent) => {
        if (!resizeStateRef.current.active) {
          return
        }

        setStoredHeight(clampHeight(window.innerHeight - moveEvent.clientY))
      }

      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
        stopResize()
      }

      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
    },
    [enableResize, closed, clampHeight, setStoredHeight, stopResize]
  )

  return (
    <div
      {...props}
      id={id}
      data-closed={closed}
      className={clsx(
        'pullout',
        'fixed left-0 bottom-0 z-30',
        'w-full',
        'pt-10',
        'pointer-events-none',
        className
      )}
    >
      {isResizing ? (
        <div
          className="fixed inset-0 z-50 cursor-row-resize pointer-events-auto"
          aria-hidden="true"
        />
      ) : null}
      {/* shade */}
      <div
        className={clsx(
          'absolute top-0 bottom-0 left-0 right-0',
          'bg-white dark:bg-black',
          'w-full',
          'pointer-events-none',
          {
            'h-0 overflow-hidden': closed,
            'h-full': !closed,
          }
        )}
        style={{
          // @note cannot use gradient-mask because it uses % - fixed 80px mask
          // fade ensures consistent density regardless of height
          maskImage: 'linear-gradient(to bottom, transparent 0px, black 80px)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0px, black 80px)',
        }}
      />
      {/* content */}
      <div className="relative">
        {/* handle bar */}
        <div ref={handleBarRef} className="handle-bar flex flex-row items-end">
          {/* handle */}
          <button
            type="button"
            aria-label={handleAriaLabel}
            data-hint-phase={hintPhase}
            className={clsx(
              'handle',
              'relative',
              'inline-flex items-center justify-center gap-2',
              'ml-40 -mb-[1px]',
              'border-l border-t border-r border-gray-200 dark:border-gray-800',
              'rounded-t-xl',
              'w-32 h-8',
              'bg-white dark:bg-black',
              'text-gray-500 dark:text-gray-400',
              'pointer-events-auto cursor-pointer',
              'origin-bottom transition-[background-color,border-color,color,opacity,transform] duration-300',
              {
                'translate-y-4 opacity-0': closed && hintPhase === 'hidden',
                'translate-y-0 opacity-100': !closed || hintPhase !== 'hidden',
                'scale-y-[1.35]': closed && hintPhase === 'expanded',
                'scale-y-100': !closed || hintPhase !== 'expanded',
              },
              {
                '!text-white !bg-indigo-500 hover:!bg-indigo-600':
                  handleSemantics && closed,
                'dark:!text-black dark:!bg-white dark:hover:!bg-gray-50':
                  handleSemantics && closed,
              }
            )}
            onClick={() => setClosed((prevClosed) => !prevClosed)}
          >
            {handleContent || <Bars2Icon className="w-5 h-5" />}
          </button>
          {/* extra */}
          <div
            className={clsx('handle-extra', '-mb-[1px]', 'flex flex-row', {
              hidden: closed,
            })}
          />
        </div>
        {/* children */}
        <div
          className={clsx(
            'relative',
            {
              'pointer-events-auto': !isResizing,
              'pointer-events-none': isResizing,
            },
            {
              'transition-all duration-300': !isResizing,
            },
            'bg-white dark:bg-black',
            {
              'h-0 overflow-hidden': closed,
              'border-t border-gray-200 dark:border-gray-800': !closed,
            }
          )}
          style={{
            height: closed ? undefined : `${contentHeight}px`,
            maxHeight: closed ? undefined : '80vh',
          }}
        >
          {enableResize && !closed ? (
            <div
              role="separator"
              aria-label="Resize pullout"
              aria-orientation="horizontal"
              className="absolute top-0 inset-x-0 z-10 h-3 -translate-y-1/2 cursor-row-resize"
              onPointerDown={handleResizePointerDown}
            />
          ) : null}
          {typeof children === 'function' ? children() : children}
        </div>
      </div>
    </div>
  )
}

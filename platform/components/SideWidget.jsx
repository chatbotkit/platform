import { useEffect, useMemo, useRef, useState } from 'react'
import { TiPin, TiPinOutline } from 'react-icons/ti'

import { tryParse, tryStringify } from '@/lib/json'

import Component from '@/components/Component'

import useDebounce from '@/hooks/useDebounce'
import useMouseOutsideWindow from '@/hooks/useMouseOutsideWindow'
import useWindowFocus from '@/hooks/useWindowFocus'

import clsx from 'clsx'

export function Indicator({ className, side, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        'absolute top-0 h-full w-2 transition-opacity duration-300',

        side === 'right' ? 'right-0 bg-blue-500' : 'left-0 bg-green-500',

        className
      )}
    />
  )
}

export default function SideWidget({
  className,
  expandedClassName,

  style,

  side = 'left',

  sensitivityDistance = 50,

  collapseDelay = 500,

  collapseOnBlur = false,

  pinned = false,
  expanded = pinned,

  indicatorAs = Indicator,

  stateSaveKey,

  actions,

  children,

  ...props
}) {
  // window focus and mouse outside window states

  const isWindowFocused = useWindowFocus()

  const debouncedIsWindowFocused = useDebounce(isWindowFocused, collapseDelay)

  const isMouseOutsideWindow = useMouseOutsideWindow()

  const debouncedIsMouseOutsideWindow = useDebounce(
    isMouseOutsideWindow,
    collapseDelay
  )

  // internal states

  const [isPinned, setIsPinned] = useState(pinned && expanded)
  const [isExpanded, setIsExpanded] = useState(expanded)
  const [hoverOpacity, setHoverOpacity] = useState(expanded ? 1 : 0)
  const [animationCompleted, setAnimationCompleted] = useState(expanded)

  // refs

  const widgetRef = useRef(null)

  // define handlers

  const handleMouseEnter = () => {
    if (isPinned) {
      return // if pinned, do nothing
    }

    if (isExpanded) {
      return // if expanded, do nothing
    }

    setIsExpanded(true)

    setAnimationCompleted(false)
  }

  const handleMouseLeave = (event) => {
    if (isPinned) {
      return // if pinned, do nothing
    }

    if (
      side === 'left' &&
      event.clientX < widgetRef.current.getBoundingClientRect().right
    ) {
      return
    } else if (
      side === 'right' &&
      event.clientX > widgetRef.current.getBoundingClientRect().left
    ) {
      return
    }

    setTimeout(() => {
      setIsExpanded(false)

      setAnimationCompleted(false)
    }, collapseDelay)
  }

  const handleTransitionEnd = () => {
    if (!isExpanded) {
      return // if not expanded, do nothing
    }

    setAnimationCompleted(true)
  }

  // define helpers

  const togglePin = () => {
    setIsPinned(!isPinned)
  }

  // handle mouse move outside widget

  useEffect(() => {
    const handleMouseMove = (event) => {
      if (!widgetRef.current) {
        return
      }

      const parentRect = widgetRef.current.parentElement.getBoundingClientRect()
      const widgetRect = widgetRef.current.getBoundingClientRect()

      let distanceFromEdge
      let distanceFromWidgetEdge

      if (side === 'right') {
        const rightEdge = parentRect.right

        distanceFromEdge =
          rightEdge - event.clientX - (parentRect.right - widgetRect.right)

        distanceFromWidgetEdge = widgetRect.left - event.clientX
      } else {
        const leftEdge = parentRect.left

        distanceFromEdge =
          event.clientX - leftEdge - (widgetRect.left - parentRect.left)

        distanceFromWidgetEdge = event.clientX - widgetRect.right
      }

      // handle expanding

      if (!isPinned && !isExpanded && distanceFromEdge < sensitivityDistance) {
        setHoverOpacity(0)

        setIsExpanded(true)

        return
      }

      // collapse the widget when mouse is outside the widget edge

      if (
        !isPinned &&
        isExpanded &&
        animationCompleted &&
        distanceFromWidgetEdge > 0
      ) {
        setHoverOpacity(0)

        setTimeout(() => {
          setIsExpanded(false)

          setAnimationCompleted(false)
        }, collapseDelay)

        return
      }

      // handle near edge

      if (!isExpanded) {
        setHoverOpacity(
          distanceFromEdge < 100
            ? Math.max(0, (100 - distanceFromEdge) / 100)
            : 0
        )
      }
    }

    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [
    isPinned,
    isExpanded,
    side,
    sensitivityDistance,
    animationCompleted,
    collapseDelay,
  ])

  // handle window blur and mouse outside window

  useEffect(() => {
    if (!collapseOnBlur) {
      return
    }

    if (isPinned) {
      return
    }

    if (!debouncedIsWindowFocused || debouncedIsMouseOutsideWindow) {
      setIsExpanded(false)
    }
  }, [
    isPinned,
    debouncedIsWindowFocused,
    debouncedIsMouseOutsideWindow,
    collapseDelay,
    collapseOnBlur,
  ])

  // memo children

  const memoChildren = useMemo(() => {
    return typeof children === 'function'
      ? children({
          isExpanded,
          isPinned,
          animationCompleted,
        })
      : children
  }, [children, isExpanded, isPinned, animationCompleted])

  // save and restore the pin state

  const uniqueStateSaveKey = useMemo(() => {
    if (!stateSaveKey) {
      return
    }

    return `SideWidget:::${stateSaveKey}:::${side}`
  }, [stateSaveKey, side])

  useEffect(() => {
    if (!uniqueStateSaveKey) {
      return
    }

    const timeout = setTimeout(() => {
      window.localStorage.setItem(
        uniqueStateSaveKey,
        tryStringify({
          pinned: isPinned,
        })
      ),
        1000
    })

    return () => {
      clearTimeout(timeout)
    }
  }, [isPinned, uniqueStateSaveKey])

  useEffect(() => {
    if (!uniqueStateSaveKey) {
      return
    }

    const persistedValue = window.localStorage.getItem(uniqueStateSaveKey)

    if (persistedValue !== null) {
      const parsedValue = tryParse(persistedValue)

      if (parsedValue) {
        if (parsedValue.pinned) {
          setIsPinned(true)
          setIsExpanded(true)
          setHoverOpacity(0)
          setAnimationCompleted(true)
        } else {
          setIsPinned(false)
          setIsExpanded(false)
          setHoverOpacity(0)
          setAnimationCompleted(false)
        }
      }
    }
  }, [uniqueStateSaveKey])

  // render

  return (
    <>
      {/* indicator */}
      <Component
        className={clsx('indictor', className)}
        as={indicatorAs}
        side={side}
        style={{ opacity: hoverOpacity }}
      />
      {/* content */}
      <div
        {...props}
        className={clsx(
          'content',

          'absolute top-0 z-10',

          'h-full overflow-hidden',

          'transition-width duration-300',

          className,

          isExpanded ? expandedClassName : '',

          !isExpanded ? 'w-0' : 'w-[var(--width)]',

          side === 'right' ? 'right-0' : 'left-0'
        )}
        style={{
          '--width': '300px',

          ...style,
        }}
        ref={widgetRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTransitionEnd={handleTransitionEnd}
      >
        <div className="w-full h-full flex flex-col divide-y divide-gray-200 dark:divide-gray-800">
          <div
            className={clsx('p-2 flex flex-row gap-2 items-center', {
              'justify-start': side === 'right',
              'justify-end': side === 'left',
            })}
          >
            {actions}
            <button
              className="w-4 h-4"
              type="button"
              aria-label="Toggle Pin"
              onClick={togglePin}
            >
              {isPinned ? (
                <TiPin className="w-full h-full" />
              ) : (
                <TiPinOutline className="w-full h-full" />
              )}
            </button>
          </div>
          <div className="h-full overflow-auto">{memoChildren}</div>
        </div>
      </div>
    </>
  )
}

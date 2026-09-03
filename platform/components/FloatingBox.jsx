import { useEffect, useMemo, useState } from 'react'

import Children from '@/components/Children'
import Component from '@/components/Component'

import usePrevious from '@/hooks/usePrevious'

import {
  autoPlacement,
  offset,
  useClientPoint,
  useFloating,
  useInteractions,
  useTransitionStyles,
} from '@floating-ui/react'

import clsx from 'clsx'

export const scaleTransitionStyles = {
  initial: { transform: 'scale(0)' },
  open: { transform: 'scale(1)' },
  close: { transform: 'scale(0)' },
  common: {
    transitionProperty: 'all',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '150ms',
  },
}

export default function FloatingBox({
  as = 'div',

  className,
  floatingClassName,

  x,
  y,

  placement,
  strategy = 'absolute',

  delay = 0,

  offset: _offset = 0,

  allowedPlacements = [],

  transitionStyles = {},

  onUnmount,

  children,

  ...props
}) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setTimeout(() => {
      setIsOpen(true)
    }, delay)
  }, [delay])

  const { refs, floatingStyles, context } = useFloating({
    placement,
    strategy,
    open: isOpen,
    middleware: [
      autoPlacement({
        allowedPlacements,
      }),
      offset(_offset),
    ],
  })

  const clientPoint = useClientPoint(context, { x, y })

  const { getReferenceProps, getFloatingProps } = useInteractions([clientPoint])

  const { isMounted, styles } = useTransitionStyles(
    context,
    useMemo(() => {
      switch (true) {
        case transitionStyles === 'scale': {
          return scaleTransitionStyles
        }

        case typeof transitionStyles === 'function': {
          return transitionStyles()
        }

        default: {
          return transitionStyles
        }
      }
    }, [transitionStyles])
  )

  const previousIsMounted = usePrevious(isMounted, isMounted)

  useEffect(() => {
    if (isMounted === previousIsMounted) {
      return
    }

    if (!isMounted) {
      onUnmount?.()
    }
  }, [isMounted, previousIsMounted, onUnmount])

  return (
    isMounted && (
      <Component
        as={as}
        {...props}
        ref={refs.setReference}
        {...getReferenceProps()}
        className={className}
      >
        <div
          ref={refs.setFloating}
          {...getFloatingProps()}
          style={{ ...floatingStyles, zIndex: 1000 }}
        >
          <div
            className={clsx('floating-content', floatingClassName)}
            style={styles}
          >
            <Children close={() => setIsOpen(false)}>{children}</Children>
          </div>
        </div>
      </Component>
    )
  )
}

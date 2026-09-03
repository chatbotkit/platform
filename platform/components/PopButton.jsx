import { memo, useEffect, useMemo, useState } from 'react'

import Children from '@/components/Children'
import Component from '@/components/Component'
import { GlobalRootPortal } from '@/components/GlobalRoot'

import usePrevious from '@/hooks/usePrevious'

import {
  autoPlacement,
  offset,
  useClick,
  useDismiss,
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

export default function PopButton({
  as = 'button',

  className,
  popClassName,

  caption: _caption,
  pop: _pop,

  placement,
  strategy,

  offset: _offset = 10,

  allowedPlacements = [],

  transitionStyles = {},

  closeOnClick = false,

  escapeKey = true,

  outsidePress = true,

  onUnmount,

  children,

  disabled,

  onBeforeOpen,

  ...props
}) {
  const [caption, pop] = useMemo(() => {
    if (_caption && _pop) {
      return [_caption, _pop]
    }

    if (_caption) {
      return [_caption, children]
    }

    if (_pop) {
      return [children, _pop]
    }

    return [children, null]
  }, [_caption, _pop, children])

  const [isOpen, setIsOpen] = useState(false)

  const { refs, floatingStyles, context, x, y } = useFloating({
    placement,

    strategy,

    open: isOpen,
    onOpenChange: setIsOpen,

    middleware: [
      autoPlacement({
        allowedPlacements,
      }),
      offset(_offset),
    ],
  })

  const click = useClick(context, {
    enabled: !disabled,
    toggle: true,
  })

  const dismiss = useDismiss(context, {
    enabled: !disabled,
    escapeKey: escapeKey,
    outsidePress: outsidePress,
  })

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
  ])

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

  const location = useMemo(() => {
    return {
      x,
      y,
    }
  }, [x, y])

  useEffect(() => {
    if (isOpen) {
      onBeforeOpen?.({ location })
    }
  }, [onBeforeOpen, isOpen, location])

  const referenceProps = getReferenceProps({
    ...props,
    className: clsx(className),
    ...(as === 'button' ? { type: 'button' } : null),
    ...(typeof disabled !== 'undefined' ? { disabled } : null),
  })

  return caption ? (
    <>
      <Component as={as} ref={refs.setReference} {...referenceProps}>
        <Children open={isOpen} close={() => setIsOpen(false)}>
          {caption}
        </Children>
      </Component>
      {isMounted && pop && (
        <GlobalRootPortal>
          <div
            ref={refs.setFloating}
            {...getFloatingProps()}
            style={{ ...floatingStyles, zIndex: 1000 }}
            onClick={() => {
              if (closeOnClick) {
                setIsOpen(false)
              }
            }}
          >
            <div className={clsx('pop-content', popClassName)} style={styles}>
              <Children close={() => setIsOpen(false)}>{pop}</Children>
            </div>
          </div>
        </GlobalRootPortal>
      )}
    </>
  ) : null
}

PopButton.Memo = memo(PopButton)

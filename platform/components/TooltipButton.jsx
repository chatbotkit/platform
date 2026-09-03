import { memo, useEffect, useMemo, useState } from 'react'

import Children from '@/components/Children'
import Component from '@/components/Component'
import { GlobalRootPortal } from '@/components/GlobalRoot'

import usePrevious from '@/hooks/usePrevious'

import {
  autoPlacement,
  offset,
  useDismiss,
  useFloating,
  useHover,
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

export default function TooltipButton({
  as = 'button',

  className,
  tooltipClassName,

  caption: _caption,
  tooltip: _tooltip,

  placement,
  strategy,

  delay,
  restMs,

  offset: _offset = 10,

  allowedPlacements = [],

  transitionStyles = {},

  onUnmount,

  children,

  disabled,

  ...props
}) {
  // @todo use https://github.com/floating-ui/floating-ui/issues/2427 to provide a group of floating elements for better animations

  const [caption, tooltip] = useMemo(() => {
    if (_caption && _tooltip) {
      return [_caption, _tooltip]
    }

    if (_caption) {
      return [_caption, children]
    }

    if (_tooltip) {
      return [children, _tooltip]
    }

    return [children, null]
  }, [_caption, _tooltip, children])

  const [isOpen, setIsOpen] = useState(false)

  const { refs, floatingStyles, context } = useFloating({
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

  const hover = useHover(context, {
    enabled: !disabled,
    delay: delay,
    restMs: restMs,
    move: false,
  })

  const dismiss = useDismiss(context, {
    enabled: !disabled,
    escapeKey: true,
    outsidePress: true,
    referencePress: true,
  })

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
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
      {isMounted && tooltip && (
        <GlobalRootPortal>
          <div
            ref={refs.setFloating}
            {...getFloatingProps()}
            style={{ ...floatingStyles, zIndex: 1000 }}
          >
            <div
              className={clsx('tooltip-content', tooltipClassName)}
              style={styles}
            >
              <Children close={() => setIsOpen(false)}>{tooltip}</Children>
            </div>
          </div>
        </GlobalRootPortal>
      )}
    </>
  ) : null
}

TooltipButton.Memo = memo(TooltipButton)

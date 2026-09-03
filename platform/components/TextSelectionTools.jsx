import { useEffect, useMemo, useState } from 'react'

import { GlobalRootPortal } from '@/components/GlobalRoot'

import useTextSelection from '@/hooks/useTextSelection'

export default function TextSelectionTools({
  target,

  children,

  position = 'center',

  placement = 'auto',

  offset = 8,

  delay = 0,

  onTextSelectionChange,

  ...props
}) {
  const { clientRect, textContent, isCollapsed } = useTextSelection(target)

  useEffect(() => {
    onTextSelectionChange?.({
      rect: clientRect,
      text: textContent,
      isCollapsed,
    })
  }, [onTextSelectionChange, clientRect, textContent, isCollapsed])

  const [showTools, setShowTools] = useState(false)

  // @note handle delay for showing tools

  useEffect(() => {
    // @note immediately hide tools when there's no valid selection

    if (!clientRect || isCollapsed || !textContent?.trim()) {
      setShowTools(false)

      return
    }

    // @note reset showTools to false first, then start delay timer

    setShowTools(false)

    if (delay > 0) {
      const timeoutId = setTimeout(() => {
        setShowTools(true)
      }, delay)

      return () => clearTimeout(timeoutId)
    } else {
      // @note show immediately if no delay

      setShowTools(true)
    }
  }, [clientRect, isCollapsed, textContent, delay])

  // @note calculate positioning based on clientRect and placement preferences

  const toolsStyle = useMemo(() => {
    if (!showTools || !clientRect || isCollapsed || !textContent?.trim()) {
      return { display: 'none' }
    }

    const style = {
      position: 'fixed',
      zIndex: 1000,
      pointerEvents: 'auto',
    }

    const viewportHeight = window.innerHeight
    const spaceAbove = clientRect.top
    const spaceBelow = viewportHeight - clientRect.bottom

    // @note determine vertical placement - auto chooses based on available space

    let finalPlacement = placement

    if (placement === 'auto') {
      finalPlacement = spaceAbove > spaceBelow ? 'top' : 'bottom'
    }

    // @note position vertically based on placement

    if (finalPlacement === 'top') {
      style.bottom = viewportHeight - clientRect.top + offset
    } else {
      style.top = clientRect.bottom + offset
    }

    // @note position horizontally based on position prop

    switch (position) {
      case 'left':
        style.left = clientRect.left

        break

      case 'right':
        style.right = window.innerWidth - clientRect.right

        break

      case 'center':
      default:
        style.left = clientRect.left + clientRect.width / 2
        style.transform = 'translateX(-50%)'

        break
    }

    return style
  }, [
    clientRect,
    isCollapsed,
    textContent,
    position,
    placement,
    offset,
    showTools,
  ])

  // @note only render when there's valid text selection and delay has passed

  if (!showTools || !clientRect || isCollapsed || !textContent?.trim()) {
    return null
  }

  return (
    <GlobalRootPortal>
      <div style={toolsStyle} {...props}>
        {typeof children === 'function'
          ? children({
              text: textContent,
              rect: clientRect,
              style: toolsStyle,
            })
          : children}
      </div>
    </GlobalRootPortal>
  )
}

import type { RefObject } from 'react'
import { useEffect, useState } from 'react'

/**
 * Due to the nature of how ResizeObserver works, the passed ref must be
 * attached to an element that can have a height. In case of a scrollable area
 * this is a wrapper element within the scrollable area, not the scrollable
 * area itself.
 */
export default function useScrollHeight(
  ref: RefObject<HTMLElement | null>,
  disabled?: boolean
): number | 'auto' {
  const [height, setHeight] = useState<number | 'auto'>('auto')

  useEffect(() => {
    if (disabled) {
      return
    }

    if (!ref.current) {
      return
    }

    function updateHeight(): void {
      if (!ref.current) {
        // @note the reason we want to return when ref.current is falsy is
        // because this code can be subject to race conditions where the
        // component is unmounted before the effect is run

        return
      }

      setHeight(ref.current.scrollHeight)
    }

    updateHeight()

    const resizeObserver = new ResizeObserver(() => {
      updateHeight()
    })

    resizeObserver.observe(ref.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [disabled, ref])

  return height
}

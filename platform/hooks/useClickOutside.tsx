import type { RefObject } from 'react'
import { useEffect } from 'react'

/**
 * Hook that detects clicks outside a referenced element and calls a handler.
 * Properly handles the case where mousedown/touchstart starts inside the element
 * but the click event fires outside.
 */
export default function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T>,
  handler: (event: MouseEvent) => void
): void {
  useEffect(() => {
    let startedInside = false
    let startedWhenMounted = false

    const listener = (event: MouseEvent): void => {
      // Do nothing if `mousedown` or `touchstart` started inside ref element
      if (startedInside || !startedWhenMounted) {
        return
      }

      // Do nothing if clicking ref's element or descendent elements
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return
      }

      handler(event)
    }

    const validateEventStart = (event: MouseEvent | TouchEvent): void => {
      startedWhenMounted = !!ref.current
      startedInside = !!(
        ref.current && ref.current.contains(event.target as Node)
      )
    }

    document.addEventListener('mousedown', validateEventStart)
    document.addEventListener('touchstart', validateEventStart)
    document.addEventListener('click', listener)

    return (): void => {
      document.removeEventListener('mousedown', validateEventStart)
      document.removeEventListener('touchstart', validateEventStart)
      document.removeEventListener('click', listener)
    }
  }, [ref, handler])
}

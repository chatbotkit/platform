import { Children, type ReactNode, useMemo } from 'react'

export default function useHasChildren(children: ReactNode): boolean {
  return useMemo(() => {
    // @note convert children to array and filter out non-renderable values
    // (null, undefined, booleans, and empty strings)

    const childArray = Children.toArray(children)

    return childArray.some((child) => {
      // @note check if it's a valid element (React elements are always renderable)

      if (typeof child === 'object') {
        return true
      }

      // @note for primitives, check if they're non-empty strings or numbers (including 0)

      if (typeof child === 'string') {
        return child.length > 0
      }

      if (typeof child === 'number') {
        return true
      }

      return false
    })
  }, [children])
}

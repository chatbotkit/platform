import { useEffect } from 'react'

/**
 * Runs a side-effect exactly once, **after the component mounts on the client**,
 * using `useEffect` with an empty dependency array.
 *
 * Because `useEffect` never runs during SSR, this is the correct hook for
 * reading browser-only APIs such as `localStorage`, `sessionStorage`, `window`,
 * or `document`. It guarantees the effect executes only in the browser,
 * eliminating hydration mismatches caused by differing server/client values.
 *
 * Use `useInitial` instead for pure synchronous computations that are safe to
 * run on the server.
 *
 * @example
 * // Safe: reads localStorage only after mount
 * useFirst(() => {
 *   const stored = localStorage.getItem('key')
 *   if (stored) setValue(JSON.parse(stored))
 * })
 */
export default function useFirst(
  fn: (() => void | (() => void)) | void | (() => void)
): void {
  return useEffect(
    () => (typeof fn === 'function' ? fn() : fn),

    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
}

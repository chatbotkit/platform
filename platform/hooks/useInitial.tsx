import { useMemo } from 'react'

/**
 * Computes and memoizes a value exactly once for the lifetime of the component,
 * using `useMemo` with an empty dependency array.
 *
 * Runs during **both SSR and client render**, making it safe for pure
 * computations that do not depend on browser-only APIs (e.g. `localStorage`,
 * `window`, `document`). Because React reuses the SSR-computed memo value
 * during hydration, the factory function will not re-execute on the client.
 *
 * Use `useFirst` instead when you need to read browser APIs after mount.
 *
 * @example
 * // Safe: pure computation, no browser APIs
 * const id = useInitial(() => generateId())
 */
export default function useInitial<T>(initial: T | (() => T)): T {
  return useMemo(
    () => (typeof initial === 'function' ? (initial as () => T)() : initial),

    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
}

import type { DependencyList } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => void

export default function useFunctionDispatch<T extends AnyFunction>(
  fn: T,
  deps?: DependencyList
): T {
  const [args, setArgs] = useState<Parameters<T> | null>(null)

  const ref = useRef<Parameters<T> | null>(null)

  const stableFn =
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useCallback(fn, deps || [])

  useEffect(() => {
    if (!args) {
      return
    }

    if (ref.current === args) {
      return
    }

    ref.current = args

    stableFn(...args)

    setArgs(null)
  }, [args, stableFn])

  return useCallback(
    ((...args: Parameters<T>) => {
      setArgs(args)
    }) as T,
    [setArgs]
  )
}

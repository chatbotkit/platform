import { useCallback, useEffect, useMemo } from 'react'

import { captureError } from '@/lib/error'

export function postMessage(type, props, target = window.parent) {
  try {
    target.postMessage({ type, props }, '*')
  } catch {
    // @note the target might be closed or not available
  }
}

export default function usePostMessageHandler(name, handler, deps) {
  const stableName = useMemo(() => {
    const n = name

    if (!n) {
      throw new Error(`Handler must have a name`)
    }

    return n
  }, [name])

  const stableHandler =
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useCallback(handler, deps)

  useEffect(
    () => {
      async function onMessage(event) {
        switch (event.data.type) {
          case stableName: {
            try {
              await handler(event.data.params || event.data.props || {})
            } catch (e) {
              // @note prevent unhandled rejection from propagating to global handler
              await captureError(e)
            }

            break
          }
        }
      }

      window.addEventListener('message', onMessage)

      return () => {
        window.removeEventListener('message', onMessage)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stableName, stableHandler, ...deps]
  )
}

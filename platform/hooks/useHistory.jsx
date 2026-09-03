import { useCallback, useRef, useState } from 'react'

/**
 * A hook that provides undo/redo functionality for state management.
 *
 * @param {Object} options - Options for the history hook
 * @param {number} [options.maxHistoryLength=50] - Maximum number of history entries
 * @returns {Object} History state and control functions
 */
export default function useHistory({ maxHistoryLength = 50 } = {}) {
  // @note history stores past states, future stores undone states for redo
  const historyRef = useRef([])
  const futureRef = useRef([])

  // @note counter to force re-render when history changes since refs don't
  // trigger updates

  const [, setRenderTrigger] = useState(0)

  const pushState = useCallback(
    (state) => {
      // @note add state to history, clear future since new actions invalidate
      // redo

      historyRef.current = [...historyRef.current, state].slice(
        -maxHistoryLength
      )

      futureRef.current = []

      setRenderTrigger((n) => n + 1)
    },
    [maxHistoryLength]
  )

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) {
      return null
    }

    // @note pop from history, push current state to future for redo

    const previousState = historyRef.current[historyRef.current.length - 1]

    historyRef.current = historyRef.current.slice(0, -1)
    setRenderTrigger((n) => n + 1)

    return previousState
  }, [])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) {
      return null
    }

    // @note pop from future, push to history

    const nextState = futureRef.current[0]

    futureRef.current = futureRef.current.slice(1)

    setRenderTrigger((n) => n + 1)

    return nextState
  }, [])

  const pushToFuture = useCallback((state) => {
    // @note add current state to future before undo completes

    futureRef.current = [state, ...futureRef.current]
  }, [])

  const canUndo = historyRef.current.length > 0
  const canRedo = futureRef.current.length > 0

  const clear = useCallback(() => {
    historyRef.current = []
    futureRef.current = []

    setRenderTrigger((n) => n + 1)
  }, [])

  return {
    pushState,
    undo,
    redo,
    pushToFuture,
    canUndo,
    canRedo,
    clear,
    historyLength: historyRef.current.length,
    futureLength: futureRef.current.length,
  }
}

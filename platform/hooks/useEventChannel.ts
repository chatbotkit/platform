import { useCallback, useMemo, useRef } from 'react'

export type EventChannelListener<Event> = (event: Event) => void

export type EventChannel<Event> = {
  emit: (event: Event) => void
  subscribe: (listener: EventChannelListener<Event>) => () => void
}

export default function useEventChannel<
  Event = unknown,
>(): EventChannel<Event> {
  const listenersRef = useRef(new Set<EventChannelListener<Event>>())

  const emit = useCallback((event: Event) => {
    for (const listener of Array.from(listenersRef.current)) {
      listener(event)
    }
  }, [])

  const subscribe = useCallback((listener: EventChannelListener<Event>) => {
    listenersRef.current.add(listener)

    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  return useMemo(
    () => ({
      emit,
      subscribe,
    }),
    [emit, subscribe]
  )
}

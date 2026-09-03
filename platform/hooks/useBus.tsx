import { useCallback, useEffect, useRef } from 'react'

const buses = new Map<string, EventTarget>()

function getBus(channel: string): EventTarget {
  if (!buses.has(channel)) {
    buses.set(channel, new EventTarget())
  }

  return buses.get(channel)!
}

export function usePublish<T = unknown>(channel: string): (data: T) => void {
  const bus = getBus(channel)

  return useCallback(
    (data: T) => {
      bus.dispatchEvent(new CustomEvent('msg', { detail: data }))
    },
    [bus]
  )
}

export function useListen<T = unknown>(
  channel: string,
  callback: (data: T) => void
): void {
  const bus = getBus(channel)

  const cbRef = useRef(callback)

  useEffect(() => {
    cbRef.current = callback
  })

  useEffect(() => {
    const handler = (e: Event) => cbRef.current((e as CustomEvent<T>).detail)

    bus.addEventListener('msg', handler)

    return () => bus.removeEventListener('msg', handler)
  }, [bus])
}

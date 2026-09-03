import { useEffect, useMemo } from 'react'

import useBroadcastChannel from '@/hooks/useBroadcastChannel'

const broadcastChannelName = 'chatbotkit:::trace'

/**
 * @typedef {{
 *   event: (type: string, data: any) => void
 *   log: (...args: any[]) => void
 * }} Trace
 */

export function useTraceClient() {
  const broadcastChannel = useBroadcastChannel(broadcastChannelName)

  return useMemo(() => {
    return new (class TraceClient {
      event(type, data) {
        let url
        let title

        try {
          url = window.location.href
          title = document.title
        } catch (e) {
          // pass
        }

        if (broadcastChannel) {
          try {
            broadcastChannel.postMessage({ type, data, window: { url, title } })
          } catch (e) {
            // @note the channel might be closed
          }
        }
      }

      log(...args) {
        this.event('log', args)
      }
    })()
  }, [broadcastChannel])
}

export function useTraceServer(onEvent) {
  const broadcastChannel = useBroadcastChannel(broadcastChannelName)

  useEffect(() => {
    if (!broadcastChannel) {
      return
    }

    const handleMessage = (event) => {
      if (event.data && event.data.type && onEvent) {
        onEvent(event.data.type, event.data.data, event.data.window)
      }
    }

    broadcastChannel.addEventListener('message', handleMessage)

    return () => {
      broadcastChannel.removeEventListener('message', handleMessage)
    }
  }, [broadcastChannel, onEvent])
}

export default useTraceClient

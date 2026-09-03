import { useEffect } from 'react'

/**
 * An iframe element with a content window reference.
 */
interface IframeRef {
  contentWindow: Window | null
}

/**
 * Hook to handle incoming "ready" messages from an iframe or any window.
 *
 * @param handler - Callback to invoke when a "ready" message is received
 * @param iframe - Optional iframe element to filter messages from
 */
export function useReadyNotificationHandler(
  handler: () => void,
  iframe: IframeRef | null = null
): void {
  useEffect(() => {
    const handleMessage = (event: MessageEvent): void => {
      if (iframe) {
        if (event.source !== iframe.contentWindow) {
          return
        }
      }

      if (event.data === 'ready') {
        handler()
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [handler, iframe])
}

/**
 * Hook to post a "ready" message to the parent window.
 *
 * @param ready - Whether to send the ready notification (defaults to true)
 */
export default function useReadyNotification(ready: boolean = true): void {
  useEffect(() => {
    if (!ready) {
      return
    }

    window.parent?.postMessage('ready', '*')
  }, [ready])
}

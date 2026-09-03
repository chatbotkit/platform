import { useEffect, useRef } from 'react'

export default function ReadyFrame({ title, onReady, onLoad, ...props }) {
  const iframeRef = useRef(null)

  useEffect(() => {
    const iframe = iframeRef.current

    if (iframe) {
      try {
        const isLoaded =
          iframe.contentDocument?.readyState === 'complete' ||
          iframe.contentWindow?.document?.readyState === 'complete'

        if (isLoaded) {
          if (onReady) {
            onReady()
          }

          if (onLoad) {
            onLoad()
          }
        }
      } catch {
        // @note for cross-origin iframes, we can't access contentDocument
      }
    }
  }, [onReady, onLoad])

  return (
    <iframe
      title={title}
      {...props}
      ref={iframeRef}
      onLoad={(event) => {
        if (onReady) {
          onReady()
        }

        if (onLoad) {
          onLoad(event)
        }
      }}
    />
  )
}

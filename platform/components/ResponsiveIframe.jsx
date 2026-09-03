import { useEffect, useRef } from 'react'

export default function ResponsiveIframe({ srcDoc, ...props }) {
  const iframeRef = useRef(null)

  useEffect(() => {
    function handleResize() {
      try {
        const scrollHeight =
          iframeRef.current.contentWindow?.document?.documentElement
            ?.scrollHeight

        if (scrollHeight) {
          iframeRef.current.style.height = scrollHeight + 'px'
        }
      } catch {
        // pass
      }
    }

    handleResize()

    const iframe = iframeRef.current

    iframe.addEventListener('load', handleResize)
    window.addEventListener('resize', handleResize)

    return () => {
      iframe.removeEventListener('load', handleResize)
      window.removeEventListener('resize', handleResize)
    }
  }, [srcDoc])

  return <iframe ref={iframeRef} srcDoc={srcDoc} {...props} />
}

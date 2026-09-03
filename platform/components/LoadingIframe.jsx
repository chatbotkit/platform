import { useEffect, useRef, useState } from 'react'

import DotsLoader from '@/components/DotsLoader'

import clsx from 'clsx'

export default function LoadingIframe({ postMessageEvent, ...props }) {
  const iframeRef = useRef(null)

  const [iframeLoaded, setIframeLoaded] = useState(false)

  {
    useEffect(() => {
      if (!iframeRef.current) {
        return
      }

      setIframeLoaded(false)

      let isLoaded = false

      {
        try {
          if (
            iframeRef.current.contentDocument &&
            iframeRef.current.contentDocument.readyState === 'complete'
          ) {
            isLoaded = true
          }
        } catch {
          // @note for cross-origin iframes, the check might fail
        }
      }

      if (isLoaded) {
        setIframeLoaded(true)
      } else {
        const handleLoad = () => {
          setIframeLoaded(true)
        }

        const iframe = iframeRef.current

        if (iframe) {
          iframe.addEventListener('load', handleLoad)

          return () => {
            iframe.removeEventListener('load', handleLoad)
          }
        }
      }
    }, [])
  }

  const [iframeReady, setIframeReady] = useState(false)

  {
    useEffect(() => {
      if (!iframeRef.current) {
        return
      }

      if (!postMessageEvent) {
        return
      }

      setIframeReady(false)

      const handleMessage = (event) => {
        if (event.source !== iframeRef.current?.contentWindow) {
          return
        }

        if (event.data === postMessageEvent) {
          setIframeReady(true)
        }
      }

      window.addEventListener('message', handleMessage)

      return () => window.removeEventListener('message', handleMessage)
    }, [postMessageEvent])
  }

  const [loaded, setLoaded] = useState(true)

  {
    useEffect(() => {
      if (postMessageEvent) {
        setLoaded(iframeReady)
      } else {
        setLoaded
      }
    }, [postMessageEvent, iframeLoaded, iframeReady])
  }

  return (
    <div className={clsx('relative', props.className)}>
      <iframe
        ref={iframeRef}
        {...props}
        className={clsx(
          'opacity-100',
          props.className,
          { 'opacity-0': !loaded },
          'transition-opacity duration-300 ease-in-out'
        )}
      />
      <div
        className={clsx(
          'absolute inset-0 flex items-center justify-center',
          'opacity-0',
          'transition-opacity duration-300 ease-in-out',
          {
            'opacity-100': !loaded,
          }
        )}
      >
        <DotsLoader className="text-xl text-gray-500 dark:text-gray-500" />
      </div>
    </div>
  )
}

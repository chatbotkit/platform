import { useEffect, useRef, useState } from 'react'

import clsx from 'clsx'

// @note global cache to track loaded images across all component instances

const loadedImageCache = new Set()

export default function ReadyImage({
  alt,
  src,

  className,
  readyClassName,
  notReadyClassName,

  onReady,
  onLoad,

  ...props
}) {
  const imgRef = useRef(null)

  const hasCalledCallbacksRef = useRef(false)

  // @note check cache first to determine initial ready state

  const [isReady, setIsReady] = useState(() => loadedImageCache.has(src))

  useEffect(() => {
    const img = imgRef.current

    // @note reset callback flag when src changes

    hasCalledCallbacksRef.current = false

    // @note if already in cache or image is complete, mark as ready

    if (
      loadedImageCache.has(src) ||
      (img && img.complete && img.naturalHeight !== 0)
    ) {
      setIsReady(true)

      if (!hasCalledCallbacksRef.current) {
        hasCalledCallbacksRef.current = true

        if (onReady) {
          onReady()
        }

        if (onLoad) {
          onLoad()
        }
      }
    } else {
      setIsReady(false)
    }
  }, [src, onReady, onLoad])

  const handleLoad = (event) => {
    // @note add to cache when image loads

    loadedImageCache.add(src)

    setIsReady(true)

    // @note only call callbacks if not already called

    if (!hasCalledCallbacksRef.current) {
      hasCalledCallbacksRef.current = true

      if (onReady) {
        onReady()
      }

      if (onLoad) {
        onLoad(event)
      }
    }
  }

  return (
    <img
      alt={alt}
      src={src}
      {...props}
      ref={imgRef}
      className={clsx(className, {
        [readyClassName]: isReady && readyClassName,
        [notReadyClassName]: !isReady && notReadyClassName,
      })}
      onLoad={handleLoad}
    />
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'

import Children from '@/components/Children'

import clsx from 'clsx'

export default function LoadMoreButton({
  hasMore,
  loadMore,

  autoLoad = false,

  onClick,

  className,

  loadingClassName,

  children,

  scrollContainerRef,

  disabled,

  ...props
}) {
  const ref = useRef()

  const loadingRef = useRef(false) // @note ref prevents concurrent loadMore calls during rapid scroll/click

  const [isLoading, setIsLoading] = useState(false)

  const handleLoadMore = useCallback(async () => {
    if (loadingRef.current) {
      return
    }

    if (!hasMore) {
      return
    }

    loadingRef.current = true

    setIsLoading(true)

    try {
      await loadMore()
    } finally {
      loadingRef.current = false

      setIsLoading(false)
    }
  }, [hasMore, loadMore])

  async function handleOnClick(event) {
    event.preventDefault()
    event.stopPropagation()

    await handleLoadMore()

    onClick?.(event)
  }

  useEffect(() => {
    if (!autoLoad) {
      return
    }

    const container = scrollContainerRef?.current || window

    // @note we use a passive scroll listener for performance while still
    // preventing duplicate loads

    let ticking = false // @note requestAnimationFrame batching prevents layout thrash on rapid scroll

    function maybeLoad() {
      ticking = false

      if (!ref.current) {
        return
      }

      if (!hasMore || loadingRef.current) {
        return
      }

      if (container === window) {
        const triggerY = ref.current.offsetTop
        const viewportBottom = window.scrollY + window.innerHeight

        if (viewportBottom < triggerY) {
          return
        }
      } else {
        const containerRect = container.getBoundingClientRect()
        const buttonRect = ref.current.getBoundingClientRect()

        if (buttonRect.top > containerRect.bottom) {
          return
        }
      }

      handleLoadMore()
    }

    function handleScroll() {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(maybeLoad)
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    // attempt immediate autoload in case button already visible

    maybeLoad()

    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [autoLoad, handleLoadMore, hasMore, scrollContainerRef])

  if (!hasMore) {
    return null
  }

  return (
    <button
      {...props}
      ref={ref}
      className={clsx(className, {
        [loadingClassName]: isLoading && loadingClassName,
      })}
      type="button"
      onClick={handleOnClick}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
    >
      <Children isLoading={isLoading} disabled={disabled}>
        {children || (isLoading ? 'Loading...' : 'Load more')}
      </Children>
    </button>
  )
}

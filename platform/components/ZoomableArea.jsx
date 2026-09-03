import { useEffect, useMemo } from 'react'

import Component from '@/components/Component'
import { GlobalRootPortal } from '@/components/GlobalRoot'

import useControlledState from '@/hooks/useControlledState'

import { XMarkIcon } from '@heroicons/react/24/outline'

import clsx from 'clsx'

export default function ZoomableArea({
  className,

  zoomedContainerClassName,
  zoomedContentClassName,

  defaultZoomed: _defaultZoomed = false,
  zoomed: _zoomed,
  setZoomed: _setZoomed,

  children,

  ...props
}) {
  // @todo add animations

  const [zoomed, setZoomed] = useControlledState(
    _defaultZoomed,
    _zoomed,
    _setZoomed
  )

  useEffect(() => {
    if (!zoomed) {
      return
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setZoomed(false)
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [zoomed, setZoomed])

  useEffect(() => {
    if (zoomed) {
      // @note disable scrolling on the body when zoomed

      const originalOverflow = document.body.style.overflow

      document.body.style.overflow = 'hidden'

      return () => {
        // @note restore original overflow when unzoomed

        document.body.style.overflow = originalOverflow
      }
    }
  }, [zoomed])

  const wrapper = useMemo(() => {
    if (zoomed) {
      return function Fullscreen({ children }) {
        return (
          <GlobalRootPortal>
            <div
              className={clsx(
                'fixed z-[60] top-0 left-0 w-screen h-screen',
                'auto-bg-white',
                'motion-preset-expand motion-duration-75',
                zoomedContainerClassName
              )}
            >
              <div className={zoomedContentClassName}>{children}</div>
            </div>
            <button
              className={clsx(
                'fixed z-[60] top-5 left-5',
                'text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200',
                'transition-all duration-300 ease-in-out'
              )}
              type="button"
              onClick={() => setZoomed(false)}
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </GlobalRootPortal>
        )
      }
    }

    return 'div'
  }, [zoomedContainerClassName, zoomedContentClassName, zoomed, setZoomed])

  return (
    <Component
      {...props}
      as={wrapper}
      className={clsx('zoomable-area w-full', className)}
    >
      {children}
    </Component>
  )
}

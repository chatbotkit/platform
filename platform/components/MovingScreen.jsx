// import { PiMouseScrollThin } from 'react-icons/pi'
import { useEffect, useRef, useState } from 'react'

import Component from '@/components/Component'
import Link from '@/components/Link'

import clsx from 'clsx'

export default function MovingScreen({
  className,

  title,
  titleAs = 'h2',

  description,
  descriptionAs = 'p',

  href,
  hrefTarget,
  hrefCaption,
  hrefStyle,

  actions,

  content,

  scrollable = false,

  scrollReveal = true,

  debug = false,

  children,

  movingScreenHeroClassName,

  movingScreenContainerMinHeight,
  movingScreenContainerMaxHeight,

  movingScreenScrollHeight,
  movingScreenExposeMaxHeight,

  layout = 'grid',

  style,

  ...props
}) {
  const sectionRef = useRef(null)

  const [heroProgress, setHeroProgress] = useState(scrollReveal ? 0 : 1)

  useEffect(() => {
    if (!scrollReveal) {
      return
    }

    const el = sectionRef.current

    if (!el) {
      return
    }

    function onScroll() {
      const rect = el.getBoundingClientRect()

      const viewH = window.innerHeight
      const SM_BREAKPOINT = 640

      if (window.innerWidth < SM_BREAKPOINT) {
        setHeroProgress(1)

        return
      }

      // Start revealing only after section top has passed viewport bottom by 1vh
      // (i.e. after scrolling 100vh past the section entering view)

      const revealStart = 0
      const revealEnd = -viewH * 0.3

      if (rect.top > revealStart) {
        setHeroProgress(0)

        return
      }

      const progress = Math.min(
        1,
        Math.max(0, (revealStart - rect.top) / (revealStart - revealEnd))
      )

      setHeroProgress(progress)
    }

    onScroll()

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [scrollReveal])

  return (
    <div
      ref={sectionRef}
      {...props}
      className={clsx(
        className,

        'moving-screen',

        {
          'bg-red-500': debug,
        }
      )}
      style={{
        ...style,

        '--moving-screen-container-min-height': movingScreenContainerMinHeight,
        '--moving-screen-container-max-height': movingScreenContainerMaxHeight,
        '--moving-screen-scroll-height': movingScreenScrollHeight,
        '--moving-screen-expose-max-height': movingScreenExposeMaxHeight,
      }}
    >
      <div
        className={clsx('moving-screen-container', {
          'sm:h-screen sm:min-h-[var(--moving-screen-container-min-height,600px)] sm:max-h-[var(--moving-screen-container-max-height,1800px)] grid grid-rows-2':
            !scrollable && layout === 'grid',
          'sm:h-screen sm:min-h-[var(--moving-screen-container-min-height,600px)] sm:max-h-[var(--moving-screen-container-max-height,1800px)] flex flex-col':
            !scrollable && layout === 'flex',
        })}
      >
        {/* scroll */}
        <div
          className={clsx(
            // name

            'moving-screen-scroll',

            // properties

            {
              'sm:h-[var(--moving-screen-scroll-height,150vh)]': scrollable,
              'self-center': !scrollable,
            }
          )}
        >
          {/* hero */}
          <div
            className={clsx(
              // name

              'moving-screen-hero',

              // properties

              'flex flex-col gap-6',

              'mx-auto',

              'px-5 sm:px-0',

              'max-w-2xl',

              'text-center',

              'pt-16',

              movingScreenHeroClassName,

              {
                'bg-blue-500': debug,
              },

              {
                'sm:sticky sm:top-[calc(100vh/3)]': scrollable,
              }
            )}
            style={{
              opacity: heroProgress,
            }}
          >
            {title ? (
              <Component
                className="mega-title [text-wrap:balance]"
                as={titleAs}
              >
                {Array.isArray(title) ? (
                  <>
                    {title[0]}{' '}
                    <span className="heading-highlight">{title[1]}</span>
                  </>
                ) : (
                  title
                )}
              </Component>
            ) : null}
            {description ? (
              <Component
                className="text-base sm:text-lg md:text-xl text-gray-500 dark:text-gray-500 [text-wrap:pretty]"
                as={descriptionAs}
              >
                {description}
              </Component>
            ) : null}
            {href || actions ? (
              <div className="flex flex-row gap-4 justify-center">
                {href ? (
                  <Link
                    className={clsx('default-button', {
                      'default-button': !hrefStyle || hrefStyle === 'default',
                      'primary-button': hrefStyle === 'primary',
                    })}
                    href={href}
                    target={hrefTarget}
                  >
                    {hrefCaption}
                  </Link>
                ) : null}
                {actions}
              </div>
            ) : null}
            {content}
            {/* {scrollable ? (
              <PiMouseScrollThin className="opacity-0 sm:opacity-100 mx-auto h-8 w-8 text-gray-200 dark:text-gray-800 motion-safe:animate-ping" />
            ) : null} */}
          </div>
        </div>
        {/* expose */}
        <div
          className={clsx(
            // name

            'moving-screen-expose',

            // properties

            'max-h-[var(--moving-screen-expose-max-height,100%)]',

            'overflow-hidden',

            'pt-8'
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

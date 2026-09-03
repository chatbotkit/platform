import { Fragment, createElement } from 'react'

import { splitHalf } from '@/lib/array'

import Component from '@/components/Component'
import DynamicIcon from '@/components/DynamicIcon'

import clsx from 'clsx'

export default function Hero({
  className,

  mainClassName,

  icon,
  image,

  title,
  splitTitle,

  titleAs = 'h1',
  titleClassName,
  titlePartsClassName,

  description,
  descriptionClassName,

  compact = false,

  children,

  extra,
}) {
  if (splitTitle) {
    const [t, st] = splitHalf(splitTitle.split(/\s+/g) || '')

    title = [t.join?.(' '), st.join?.(' ')]
  }

  const titleParts = Array.isArray(title) ? title : [title]

  return (
    <div
      className={clsx(
        // name
        'hero',

        'relative overflow-hidden',

        // other styles
        className
      )}
    >
      <div
        className={clsx(
          'relative main-page',
          {
            'main-page-xl': compact === 'xl',
            'main-page-2xl': compact === '2xl',
            'main-page-3xl': compact === '3xl',
            'main-page-4xl': compact === '4xl',
            'main-page-5xl': compact === '5xl',
            'main-page-6xl': compact === '6xl',
            'main-page-7xl': compact === '7xl',
          },
          // @note lets a page widen the centred column without switching to the
          // left-aligned compact layout
          mainClassName
        )}
      >
        {/* @note the reason for the wrapping div is because main-page introduces spacing between its child elements and we don't want that */}
        <div
          className={clsx('content', 'space-y-3 md:space-y-5', {
            'text-center': !compact,
            'text-left': compact,
          })}
        >
          {/* header */}
          <div className="space-y-3 md:space-y-5">
            <Component
              className={clsx(
                // @note this has effect on tracking and this is why it is left here
                'text-4xl sm:text-5xl md:text-6xl tracking-tight',

                // font
                'font-medium',

                // color
                'text-gray-900 dark:text-gray-100',

                // balance the title across lines to avoid awkward wraps
                // (text-wrap is inherited, so it reaches the inner line box)
                '[text-wrap:balance]',

                // additional classes
                titleClassName
              )}
              as={titleAs}
            >
              {!compact && icon ? (
                <DynamicIcon
                  className="w-40 h-40 block mx-auto mb-8 rounded-full"
                  icon={icon}
                  alt="icon"
                />
              ) : null}
              {!compact && image ? (
                typeof image === 'string' ? (
                  <img
                    className="w-40 h-40 block mx-auto mb-8"
                    src={image}
                    alt="image"
                  />
                ) : (
                  createElement(image, {
                    className: 'w-40 h-40 block mx-auto mb-8',
                  })
                )
              ) : null}
              <div
                className={clsx(
                  {
                    // compact disabled
                    'text-4xl sm:text-7xl sm:leading-[0.9em]':
                      compact === false,

                    // compact enabled
                    'text-4xl sm:leading-[0.9em]': compact === true,

                    // specific compact sizes
                    'text-4xl sm:text-7xl sm:leading-[0.9em]':
                      typeof compact === 'string',
                  },
                  titlePartsClassName
                )}
              >
                {titleParts.map((t, i) => (
                  <Fragment key={i}>
                    <span
                      className={clsx({
                        'heading-highlight': i % 2 === 1,
                      })}
                    >
                      {t}
                    </span>
                    {i < titleParts.length - 1 ? ' ' : null}
                  </Fragment>
                ))}
              </div>
            </Component>
            {description ? (
              <p
                className={clsx(
                  'text-gray-500 dark:text-gray-500',
                  'line-clamp-5',
                  {
                    'text-base sm:text-lg md:text-xl': !compact,
                    'text-base': compact,
                  },
                  // @note default avoids an orphan word on the last line; a page
                  // can pass its own wrap (e.g. [text-wrap:balance]) to override
                  // it - they set the same CSS property so we replace, not append
                  descriptionClassName || '[text-wrap:pretty]'
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
          {/* children */}
          {children ? (
            <div
              className={clsx(
                'text-base sm:text-lg md:text-xl',
                // 'text-indigo-500 dark:text-indigo-500',
                'flex flex-col sm:flex-row gap-4'
              )}
            >
              {children}
            </div>
          ) : null}
        </div>
      </div>
      {extra}
    </div>
  )
}

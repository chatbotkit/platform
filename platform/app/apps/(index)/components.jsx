import { useMemo, useState } from 'react'

import { apps as configApps } from '@/config/apps'

import { AppScene } from '@/layouts/App'

import DynamicIcon from '@/components/DynamicIcon'
import Link from '@/components/Link'

import { ChevronRightIcon } from '@heroicons/react/20/solid'

import clsx from 'clsx'

export function Scene({ className, ...props }) {
  return (
    <AppScene
      {...props}
      className={clsx('scene', className)}
      name={null}
      headline={null}
      description={null}
    />
  )
}

export function AppList({ apps: _apps = [] }) {
  const apps = useMemo(() => {
    return _apps.map((app) => {
      const {
        slug,

        id = slug,

        short_name,
        short_description,

        name = short_name,
        description = short_description,

        icon = '@heroicons/puzzle-piece',
        logo = icon,

        banner,

        order,
      } = app

      const instance = configApps.find(
        (app) => app.slug === slug || app.id === id
      )

      return {
        id,

        slug,

        name: name || instance?.name,
        description: description || instance?.description,

        icon: icon || instance?.icon,
        logo: logo || instance?.logo,

        banner: banner || instance?.banner,

        order: order ?? instance?.order,
      }
    })
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  }, [_apps])

  const banners = apps.filter(({ banner }) => !!banner)

  const spanAfter = 2

  return (
    <div className="space-y-3">
      <BannerCarousel banners={banners} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {apps.map(
          (
            {
              slug,

              name,
              description,

              icon,
              logo,
            },
            index
          ) => {
            const featured = index < spanAfter

            return (
              <div
                key={slug}
                className={clsx(
                  'relative group',
                  'flex flex-col',
                  'overflow-hidden',
                  'rounded-xl',
                  'border auto-border-gray-200',
                  'transition-all ease-in-out duration-200',
                  'hover:shadow-md hover:auto-border-gray-300',
                  featured
                    ? 'auto-bg-gray-50 hover:auto-bg-white'
                    : 'sm:col-span-2 auto-bg-gray-50 hover:auto-bg-white'
                )}
              >
                <div className="flex items-center gap-4">
                  {icon ? (
                    <div
                      className={clsx(
                        'flex shrink-0 items-center justify-center',
                        featured ? 'p-5 pr-0' : 'p-4 pr-0'
                      )}
                    >
                      <div
                        className={clsx(
                          'flex items-center justify-center rounded-xl auto-bg-gray-100',
                          featured ? 'h-16 w-16 p-3' : 'h-10 w-10 p-2'
                        )}
                      >
                        <DynamicIcon
                          className="h-full w-full object-contain"
                          icon={logo || icon}
                          fallbackIcon={`@ui-avatars/${name}`}
                          alt={name}
                        />
                      </div>
                    </div>
                  ) : null}
                  <div
                    className={clsx(
                      'flex flex-1 flex-col py-4 pr-4',
                      featured ? 'space-y-1.5' : 'space-y-0.5',
                      { 'pl-0': !!icon }
                    )}
                  >
                    <h3
                      className={clsx(
                        'font-medium auto-text-gray-900 line-clamp-1',
                        featured ? 'text-base' : 'text-sm'
                      )}
                    >
                      <Link href={`/apps/${slug}`}>
                        <span aria-hidden="true" className="absolute inset-0" />
                        {name || slug}
                      </Link>
                    </h3>
                    <p
                      className={clsx(
                        'auto-text-gray-500',
                        featured
                          ? 'text-sm line-clamp-2'
                          : 'text-xs line-clamp-1'
                      )}
                    >
                      {description || 'An app without description.'}
                    </p>
                  </div>
                </div>
              </div>
            )
          }
        )}
      </div>
    </div>
  )
}

function BannerCarousel({ banners = [] }) {
  // Track an unbounded position and clone the first banner at the end so that
  // advancing past the last banner sweeps continuously into the first one. Once
  // the clone is reached we snap back to the real first banner without a
  // transition, giving the impression of an endless one-directional loop.
  const [position, setPosition] = useState(0)
  const [animated, setAnimated] = useState(true)

  if (banners.length === 0) {
    return null
  }

  const multiple = banners.length > 1
  const slides = multiple ? [...banners, banners[0]] : banners

  const next = () => {
    setAnimated(true)
    setPosition((value) => Math.min(value + 1, banners.length))
  }

  const handleTransitionEnd = () => {
    if (position === banners.length) {
      setAnimated(false)
      setPosition(0)
    }
  }

  return (
    <div
      className={clsx(
        'relative group',
        'overflow-hidden',
        'rounded-xl',
        'border auto-border-gray-200',
        'aspect-[21/9]',
        'transition-all ease-in-out duration-200',
        'hover:shadow-md hover:auto-border-gray-300'
      )}
    >
      <div
        className={clsx(
          'flex h-full w-full',
          animated && 'transition-transform duration-500 ease-in-out'
        )}
        style={{ transform: `translateX(-${position * 100}%)` }}
        onTransitionEnd={handleTransitionEnd}
      >
        {slides.map(({ slug, name, description, banner }, index) => (
          <div
            key={`${slug}-${index}`}
            className="relative flex h-full w-full shrink-0 flex-col justify-end"
          >
            <img
              src={banner}
              alt={name || slug}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            <div className="relative flex flex-col items-start gap-3 p-6">
              <h3 className="text-2xl font-semibold text-white line-clamp-1">
                {name || slug}
              </h3>
              <p className="max-w-md text-sm text-white/80 line-clamp-2">
                {description || 'An app without description.'}
              </p>
              <Link
                href={`/apps/${slug}`}
                className="inline-flex items-center rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-100"
              >
                Try now
              </Link>
            </div>
          </div>
        ))}
      </div>

      {multiple ? (
        <button
          type="button"
          onClick={next}
          aria-label="Next banner"
          className={clsx(
            'absolute right-4 top-1/2 -translate-y-1/2',
            'flex h-10 w-10 items-center justify-center',
            'rounded-full bg-white/90 text-gray-900 shadow-md',
            'opacity-0 transition-opacity duration-200 group-hover:opacity-100',
            'hover:bg-white'
          )}
        >
          <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

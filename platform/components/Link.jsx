import { forwardRef, useEffect, useMemo, useState } from 'react'

import NextLink from 'next/link'

import { ONE_MINUTE_IN_MILLISECONDS } from '@chatbotkit-dev/time'

import { isAppPathname } from '@/lib/app.helpers'
import { sameRoot } from '@/lib/url'

import CopyButton from '@/components/CopyButton'

import useRouter from '@/hooks/useRouter'
import useScopedQuerySessionOption from '@/hooks/useScopedQuerySessionOption'

import clsx from 'clsx'

export default forwardRef(function Link(
  {
    className,

    href,
    target,

    locale,

    disabled,

    prefetch,

    forcePrefetch,
    forcePrefetchInterval,

    ...props
  },
  ref
) {
  if (!href) {
    // eslint-disable-next-line no-console
    console.warn('Link: href is required')

    href = ''
  }

  const router = useRouter()

  const { isKnownHref } = router

  const embed = useScopedQuerySessionOption('_embed')

  const normalizedHref = useMemo(() => {
    return router.normalizeHref(href)
  }, [href, router])

  const resolvedHref = useMemo(() => {
    return router.resolveHref(href)
  }, [href, router])

  const resolvedTarget = useMemo(() => {
    return target
  }, [target])

  const resolvedLocale = useMemo(() => {
    return locale || router.locale || router.defaultLocale
  }, [locale, router.locale, router.defaultLocale])

  const extraProps = useMemo(() => {
    switch (true) {
      // the hostname is an app hostname

      case router.isAppHostname: {
        if (isAppPathname(normalizedHref)) {
          if (
            sameRoot(router.pathname, normalizedHref) ||
            sameRoot(router.pathname, resolvedHref)
          ) {
            return {
              rel: 'app explore-app',
            }
          } else {
            return {
              // target: ['_blank', '_parent', '_top'].includes(resolvedTarget)
              //   ? resolvedTarget
              //   : '_self',
              rel: 'app enter-app enter-app-disabled',
            }
          }
        } else {
          return {
            // target: ['_blank', '_parent', '_top'].includes(resolvedTarget)
            //   ? resolvedTarget
            //   : '_self',
            rel: 'app exit-app',
          }
        }
      }

      // the hostname is not an app hostname

      case !router.isAppHostname: {
        if (isAppPathname(normalizedHref)) {
          if (
            sameRoot(router.pathname, normalizedHref) ||
            sameRoot(router.pathname, resolvedHref)
          ) {
            return {
              rel: 'site explore-app',
            }
          } else {
            return {
              // target: ['_blank', '_parent', '_top'].includes(resolvedTarget)
              //   ? resolvedTarget
              //   : '_self',
              rel: 'site enter-app',
            }
          }
        } else {
          if (router.isAppPathname) {
            return {
              // target: ['_blank', '_parent', '_top'].includes(resolvedTarget)
              //   ? resolvedTarget
              //   : '_self',
              rel: 'site exit-app',
            }
          } else {
            return {
              rel: 'site',
            }
          }
        }
      }

      // links to sub-pages have no extra props

      case resolvedHref?.startsWith?.('/'): {
        return {}
      }

      // links to known domains must be marked as external and send referrer

      case isKnownHref(resolvedHref): {
        return {
          rel: 'noopener external',
        }
      }

      // all other links must be marked as external and not send referrer

      default: {
        return {
          rel: 'noopener external noreferrer',
        }
      }
    }
  }, [
    normalizedHref,
    resolvedHref,
    // resolvedTarget,
    router.isAppHostname,
    router.isAppPathname,
    isKnownHref,
    router.pathname,
  ])

  const [overrideProps, setOverrideProps] = useState({})

  {
    useEffect(() => {
      if (embed) {
        return
      }

      if (window.self !== window.top) {
        setOverrideProps({
          target: '_blank',
        })
      }
    }, [embed])
  }

  const finalProps = useMemo(() => {
    return {
      as: resolvedHref,

      href: normalizedHref,

      target: resolvedTarget,

      locale: resolvedLocale,

      ...props,
      ...extraProps,
      ...overrideProps,

      ...(disabled
        ? {
            onClick: (event) => {
              event.preventDefault()
            },

            tabIndex: -1,
          }
        : {}),
    }
  }, [
    disabled,
    props,
    normalizedHref,
    resolvedHref,
    resolvedTarget,
    resolvedLocale,
    extraProps,
    overrideProps,
  ])

  const Component = useMemo(() => {
    switch (true) {
      case finalProps.href.startsWith('mailto:'): {
        const Component = forwardRef(function LinkComponent(props, ref) {
          return (
            <CopyButton
              className={props.className}
              style={props.style}
              ref={ref}
              text={href.slice(7)}
              message="Email copied to clipboard"
            >
              {props.children}
            </CopyButton>
          )
        })

        return Component
      }

      case finalProps.target === '_self': {
        const Component = forwardRef(function LinkComponent(props, ref) {
          return <a ref={ref} {...props} />
        })

        return Component
      }

      default: {
        const Component = forwardRef(function LinkComponent(props, ref) {
          return <NextLink ref={ref} {...props} prefetch={prefetch} />
        })

        return Component
      }
    }
  }, [finalProps.href, finalProps.target, href, prefetch])

  const finalHref = finalProps.href
  const finalAs = finalProps.as

  useEffect(() => {
    if (!forcePrefetch) {
      return
    }

    const doPrefetch = () => {
      if (/^(\/|https?:\/\/)/i.test(finalHref)) {
        router.prefetch(finalHref)
      }

      if (/^(\/|https?:\/\/)/i.test(finalAs)) {
        router.prefetch(finalAs)
      }
    }

    doPrefetch()

    if (forcePrefetchInterval) {
      const thisForcePrefetchInterval = Math.max(
        forcePrefetchInterval,
        ONE_MINUTE_IN_MILLISECONDS
      )

      const interval = setInterval(() => {
        doPrefetch()
      }, thisForcePrefetchInterval)

      return () => clearInterval(interval)
    }
  }, [forcePrefetch, forcePrefetchInterval, finalHref, finalAs, router])

  return (
    <Component
      ref={ref}
      className={clsx(className, {
        'disabled cursor-not-allowed': disabled,
      })}
      // @todo disabled the link
      {...finalProps}
    />
  )
})

/* eslint-disable custom-eslint-rules/no-restricted-client-imports -- href resolution seam - the runtime hostname overlays via useHostname; the constants are the fallback */

/* eslint-disable custom-eslint-rules/require-custom-use-router */
import { useCallback, useMemo } from 'react'

import {
  useParams as nextUseParams,
  usePathname as nextUsePathname,
  useSearchParams as nextUseSearchParams,
  useRouter as nextUserRouter,
} from 'next/navigation'

import { APP_TYPES } from '@/config/apps'
import { siteUrl } from '@/config/site'

import {
  getAppSlugByHostname,
  isAppHostname,
  isAppPathname,
} from '@/lib/app.helpers'
import { getExternalFrontendHostURL } from '@/lib/host'
import { tryDomain } from '@/lib/url'

import {
  useAppSlugToHostnameMap,
  useAudienceHostname,
  useCookieHostname,
  useSiteHostname,
} from '@/hooks/useHostname'

import i18n from '@/i18n.config'
import base from '@/next.config.d/base.config'

// --- Constants ---

const TRANSFERRED_QUERY_KEYS = ['_supertools', '_widget', '_experience']

// --- Helpers ---

function appendTransferredQueryOptions(href, searchParams) {
  if (!href || typeof href !== 'string') {
    return href
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(href) && !href.startsWith('https://')) {
    return href
  }

  if (href.startsWith('https://') && (!siteUrl || !href.startsWith(siteUrl))) {
    return href
  }

  const transferEntries = TRANSFERRED_QUERY_KEYS.flatMap((key) => {
    const value = searchParams?.get?.(key)

    return value == null ? [] : [[key, value]]
  })

  if (transferEntries.length === 0) {
    return href
  }

  const hashIndex = href.indexOf('#')
  const hrefWithoutHash = hashIndex === -1 ? href : href.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : href.slice(hashIndex)
  const queryIndex = hrefWithoutHash.indexOf('?')
  const pathname =
    queryIndex === -1 ? hrefWithoutHash : hrefWithoutHash.slice(0, queryIndex)
  const query = new URLSearchParams(
    queryIndex === -1 ? '' : hrefWithoutHash.slice(queryIndex + 1)
  )

  let changed = false

  for (const [key, value] of transferEntries) {
    if (!query.has(key)) {
      query.set(key, value)
      changed = true
    }
  }

  if (!changed) {
    return href
  }

  const queryString = query.toString()

  return `${pathname}${queryString ? `?${queryString}` : ''}${hash}`
}

// --- Main ---

/**
 * This is a wrapper around Next.js' useRouter hook that adds some additional
 * properties to the router object. It is meant to be a drop-in replacement for
 * the original useRouter hook with some caveats.
 *
 * The reason why we need this wrapper is because Next.js' useRouter hook does
 * not work in app routes, only in pages and we do rely on the original router
 * object in most of our components.
 *
 * In addition to the original router object, this wrapper adds additional
 * methods to handle various platform specific features like apps and domains.
 *
 * @returns {ReturnType<typeof nextUserRouter> & {
 *   basePath: string,
 *   pathname: string,
 *   asPath: string,
 *   query: Record<string, string>,
 *   params: Record<string, string>,
 *   locales: string[]
 *   locale: string
 *   defaultLocale: string,
 *   domainLocales: {domain: string, defaultLocale: string, locales: string[]}[],
 *   isFallback: boolean,
 *   isReady: boolean,
 *   isPreview: boolean,
 *   hostname: string,
 *   isSite: boolean,
 *   isAppHostname: boolean,
 *   isAppPathname: boolean,
 *   isKnownHref: (href: string) => boolean
 *   normalizeHref: (href: string|{pathname: string, query?:any}) => string
 *   resolveHref: (href: string|{pathname: string, query?:any}) => string
 *   absoluteHref: (href: string|{pathname: string, query?:any}) => string
 *   compareHref: (href: string|{pathname: string, query?:any}, options?: {exact?: boolean|'pathname'}) => boolean
 * }}
 */
export default function useRouter() {
  const router = nextUserRouter()

  const searchParams = nextUseSearchParams()

  const params = nextUseParams()

  let pathname = nextUsePathname()

  {
    // @note this is a hydration fix for the landing pages and it kind of sucks

    if (pathname?.startsWith?.('/landing')) {
      pathname = pathname.slice('/landing'.length)
    }
  }

  const cookieHostname = useCookieHostname()
  const audienceHostname = useAudienceHostname()
  const siteHostnameRuntime = useSiteHostname()

  // @note the build-time hostname table reads server-only environment, so in
  // the browser it carries no apex hosts - the runtime overlay keeps app and
  // portal hosts recognisable after hydration

  const hostnameMap = useAppSlugToHostnameMap()

  // @note only force an absolute http:// href up to https when the current
  // page is actually served over https. On an http deployment (local /
  // self-host) upgrading would send the navigation to a dead https port; worse,
  // the upgraded scheme no longer matches the http `siteUrl` prefix stripped
  // below, so the URL would be pushed absolute instead of as a relative client
  // transition. During SSR there is no document, so fall back to the
  // deployment's configured scheme.

  const isSecure =
    typeof window !== 'undefined'
      ? window.location.protocol === 'https:'
      : siteUrl.startsWith('https://')

  const appSlug = useMemo(() => {
    if (isAppHostname(cookieHostname, hostnameMap)) {
      return getAppSlugByHostname(cookieHostname, hostnameMap)
    }

    if (isAppHostname(audienceHostname, hostnameMap)) {
      return getAppSlugByHostname(audienceHostname, hostnameMap)
    }

    return null
  }, [cookieHostname, audienceHostname, hostnameMap])

  const normalizeHref = useCallback(
    (href) => {
      let result = href?.pathname || href

      {
        if (isSecure && result?.startsWith?.('http://')) {
          result = 'https://' + result.slice('http://'.length)
        }

        if (result?.startsWith?.('?')) {
          result = pathname + result
        }

        if (result?.startsWith?.('#')) {
          result = pathname + result
        }
      }

      const query = href?.query || undefined

      {
        if (query) {
          // @note q.toString() rather than q.size - jsdom and older Safari do
          // not implement URLSearchParams.size and would drop the query

          const q = new URLSearchParams(query).toString()

          if (q) {
            result += '?' + q
          }
        }
      }

      return appendTransferredQueryOptions(result, searchParams)
    },
    [isSecure, pathname, searchParams]
  )

  const resolveHref = useCallback(
    (href) => {
      let result = href?.pathname || href

      {
        if (isSecure && result?.startsWith?.('http://')) {
          result = 'https://' + result.slice('http://'.length)
        }

        if (result?.startsWith?.('?')) {
          result = pathname + result
        }

        if (result?.startsWith?.('#')) {
          result = pathname + result
        }

        if (appSlug) {
          if (result.startsWith('/apps')) {
            result = result.slice('/apps'.length)

            if (!result) {
              result = '/'
            }

            if (!APP_TYPES.includes(appSlug)) {
              for (const slug of Object.keys(hostnameMap)) {
                const lookup = `/${slug}`

                if (result === lookup) {
                  result = '/'

                  break
                } else if (result.startsWith(lookup + '/')) {
                  result = result.slice(lookup.length)

                  if (!result) {
                    result = '/'
                  }

                  break
                }
              }
            }
          }
        } else {
          if (result?.startsWith?.(siteUrl)) {
            result = result.slice(siteUrl.length)

            if (!result) {
              result = '/'
            }
          }
        }
      }

      const query = href?.query || undefined

      {
        if (query) {
          // @note q.toString() rather than q.size - jsdom and older Safari do
          // not implement URLSearchParams.size and would drop the query
          const q = new URLSearchParams(query).toString()

          if (q) {
            result += '?' + q
          }
        }
      }

      return appendTransferredQueryOptions(result, searchParams)
    },
    [appSlug, isSecure, pathname, searchParams, hostnameMap]
  )

  const absoluteHref = useCallback(
    (href) => {
      return getExternalFrontendHostURL(
        normalizeHref(href),
        cookieHostname || audienceHostname || undefined
      )
    },
    [normalizeHref, cookieHostname, audienceHostname]
  )

  const isKnownHref = useCallback(
    (href) => {
      const domain = tryDomain(href)

      if (!domain) {
        return false
      }

      const knownHostnames = Object.values(hostnameMap).concat([
        siteHostnameRuntime,
      ])

      return knownHostnames.some((knownHostname) => {
        return domain === knownHostname || domain.endsWith(`.${knownHostname}`)
      })
    },
    [siteHostnameRuntime, hostnameMap]
  )

  const compareHref = useCallback(
    (href, { exact = true } = {}) => {
      const hrefA = resolveHref(href)
      const hrefB = resolveHref({ pathname, query: searchParams })

      // @note `exact` controls how the current location is matched against `href`:
      //   - true        exact match including the query string (default)
      //   - false       prefix match - the current location starts with `href`
      //   - 'pathname'   exact match on the pathname only, ignoring the query
      switch (exact) {
        // @note ignore everything from the first '?' or '#' so the query string
        // (and hash) do not affect the comparison
        case 'pathname': {
          const stripQuery = (value) => value.split(/[?#]/, 1)[0]

          return stripQuery(hrefA) === stripQuery(hrefB)
        }

        case false: {
          return hrefB.startsWith(hrefA)
        }

        // @todo exact match is not going to work when the query is not ordered
        default: {
          return hrefA === hrefB
        }
      }
    },
    [resolveHref, pathname, searchParams]
  )

  return useMemo(() => {
    return new Proxy(router, {
      get(target, prop, receiver) {
        switch (prop) {
          case 'basePath': {
            let value = base.basePath

            return value
          }

          case 'pathname': {
            let value = pathname || '/'

            return value
          }

          case 'asPath': {
            let value = pathname

            if (searchParams?.size) {
              value += `?${searchParams.toString()}`
            }

            return value
          }

          case 'query': {
            let value = {
              ...Object.fromEntries(searchParams?.entries() || []),
              ...params,
            }

            return value
          }

          case 'params': {
            let value = params || {}

            return value
          }

          case 'locales': {
            let value = i18n.locales

            return value
          }

          case 'locale': {
            let value = i18n.defaultLocale // @todo static for now but we only support a single locale

            return value
          }

          case 'defaultLocale': {
            let value = i18n.defaultLocale

            return value
          }

          case 'domainLocales': {
            let value = i18n.domainLocales || []

            return value
          }

          case 'isFallback': {
            let value = false // @todo implement the fallback state

            return value
          }

          case 'isReady': {
            let value = true // @todo implement the ready state

            return value
          }

          case 'isPreview': {
            let value = false // @todo implement the preview state

            return value
          }

          case 'hostname': {
            let value = cookieHostname

            return value
          }

          case 'isSite': {
            let value = cookieHostname === siteHostnameRuntime

            return value
          }

          case 'isAppHostname': {
            let value = isAppHostname(cookieHostname || '', hostnameMap)

            return value
          }

          case 'isAppPathname': {
            let value = isAppPathname(pathname || '')

            return value
          }

          case 'isKnownHref': {
            let value = isKnownHref

            return value
          }

          case 'normalizeHref': {
            let value = normalizeHref

            return value
          }

          case 'resolveHref': {
            let value = resolveHref

            return value
          }

          case 'absoluteHref': {
            let value = absoluteHref

            return value
          }

          case 'compareHref': {
            let value = compareHref

            return value
          }

          case 'push': {
            return (href, ...args) => {
              router.push(resolveHref(href), ...args)
            }
          }

          case 'replace': {
            return (href, ...args) => {
              router.replace(resolveHref(href), ...args)
            }
          }

          default: {
            return Reflect.get(target, prop, receiver)
          }
        }
      },
    })
  }, [
    router,

    searchParams,

    params,

    pathname,

    cookieHostname,

    siteHostnameRuntime,

    hostnameMap,

    normalizeHref,
    resolveHref,
    absoluteHref,
    isKnownHref,
    compareHref,
  ])
}

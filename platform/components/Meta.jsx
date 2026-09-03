/* eslint-disable custom-eslint-rules/no-restricted-client-imports -- the canonical/og base is deliberately the canonical site, not the serving host */
// @ts-check
import Head from 'next/head'

import { getStartOfDay } from '@chatbotkit-dev/time'

import { siteUrl } from '@/config/site'
import { organization } from '@/config/structures'

import { warn } from '@/lib/debug'
import { isDevelopment, isStaging } from '@/lib/env'
import { getLocale } from '@/lib/og'
import { withPathnamePrefix } from '@/lib/url'

import StructuredData from '@/components/StructuredData'

import useRouter from '@/hooks/useRouter'
import useUrl from '@/hooks/useUrl'

/**
 * @typedef {{
 *   favicon?: string
 *   appManifest?: string
 *   breadcrumbs?: string[]
 *   title: string
 *   description: string
 *   keywords?: string | string[]
 *   image?: string
 *   rss?: { title: string, href: string }
 *   baseUrl?: string
 *   thisUrl?: string
 *   canonical?: string
 *   noindex?: boolean
 *   target?: string
 *   locales?: string[]|'auto'
 * }} MetaOptions
 *
 * @param {MetaOptions} props
 * @returns {import('react').JSX.Element}
 */
export default function Meta({
  favicon,

  appManifest,

  breadcrumbs,

  title,

  description,

  keywords,

  image,

  rss,

  // @note assumed Meta is SSR ran

  baseUrl = siteUrl,
  thisUrl = '',

  canonical,

  noindex = false,

  target,

  locales = 'auto',
}) {
  const router = useRouter()

  // this url
  {
    thisUrl = useUrl(baseUrl, thisUrl, { noQuery: true, noFragment: true })
  }

  // canonical url - defaults to this page, but may point elsewhere to
  // consolidate near-duplicate pages (e.g. the /ai/[category] variants)
  const canonicalUrl = canonical || thisUrl

  // breadcrumbs
  {
    if (breadcrumbs?.length) {
      // disabled because we want to experiment with better titles
      // title = [title, ...breadcrumbs].filter((f) => !!f).join(' | ')
    }
  }

  // title
  {
    if (!title) {
      warn(`missing title at ${thisUrl}`)
    }
  }

  // description
  {
    if (!description) {
      warn(`missing description at ${thisUrl}`)
    }
  }

  // keywords
  {
    if (Array.isArray(keywords)) {
      keywords = Array.from(new Set(keywords)).join(',')
    }

    keywords = keywords?.toLowerCase()
  }

  // image
  {
    image = new URL(image || `/card`, thisUrl).toString()
  }

  // locales
  {
    locales = (locales === 'auto' ? router.locales : locales) || []
  }

  // render

  return (
    <>
      <Head>
        <meta name="generator" content="ChatBotKit" />
        {favicon ? (
          <link rel="icon" href={router.resolveHref(favicon)} />
        ) : (
          <>
            <link
              rel="apple-touch-icon"
              sizes="180x180"
              href="/apple-touch-icon.png"
            />
            <link
              rel="icon"
              type="image/x-icon"
              href="/favicon-dark.ico"
              media="(prefers-color-scheme: dark)"
            />
            <link
              rel="icon"
              type="image/x-icon"
              href="/favicon-light.ico"
              media="(prefers-color-scheme: light)"
            />
          </>
        )}
        {appManifest ? (
          <link rel="manifest" href={appManifest || '/site.webmanifest'} />
        ) : null}
        {router.locale !== router.defaultLocale ? (
          <link
            rel="canonical"
            href={withPathnamePrefix(canonicalUrl, `/${router.locale}`)}
          />
        ) : (
          <link rel="canonical" href={canonicalUrl} />
        )}
        {locales.length > 1 ? (
          <>
            {locales.map((locale) => {
              const url = new URL(thisUrl)

              if (router.defaultLocale !== locale) {
                url.pathname = `/${locale}${url.pathname}`
              }

              return (
                <>
                  <link
                    key={locale}
                    rel="alternate"
                    href={url.toString()}
                    hrefLang={locale}
                  />
                  {router.defaultLocale === locale ? (
                    <link
                      rel="alternate"
                      href={url.toString()}
                      hrefLang="x-default"
                    />
                  ) : null}
                </>
              )
            })}
          </>
        ) : null}
        {isDevelopment || isStaging ? (
          <meta name="robots" content="noindex" />
        ) : noindex ? (
          <meta name="robots" content="noindex,follow" />
        ) : (
          <meta name="robots" content="index,follow" />
        )}
        {title ? <title>{title}</title> : null}
        {description ? <meta name="description" content={description} /> : null}
        {keywords ? <meta name="keywords" content={keywords} /> : null}
        <meta property="image" content={image} />
        <meta itemProp="image" content={image} />
        <meta
          property="og:locale"
          content={getLocale(router.locale || router.defaultLocale || 'en')}
        />
        <meta property="og:site_name" content={new URL(thisUrl).hostname} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={thisUrl} />
        {title ? <meta property="og:title" content={title} /> : null}
        {description ? (
          <meta property="og:description" content={description} />
        ) : null}
        <meta property="og:image" content={image} />
        <meta name="twitter:site" content="@chatbotkit" />
        <meta name="twitter:creator" content="@chatbotkit" />
        {title ? <meta name="twitter:title" content={title} /> : null}
        {description ? (
          <meta name="twitter:description" content={description} />
        ) : null}
        <meta name="twitter:image" content={image} />
        <meta name="twitter:card" content="summary_large_image" />
        {rss ? (
          <link
            rel="alternate"
            type="application/rss+xml"
            title={rss.title}
            href={rss.href}
          />
        ) : null}
        {/* @note suppressHydrationWarning prevents React hydration mismatch: getStartOfDay()
            uses setHours(0,0,0,0) which is timezone-dependent. Server (UTC) renders
            midnight UTC but client (e.g. UTC-8) renders a different ISO string.
            This caused Sentry issues 54 and 58 for all non-UTC users. */}
        <meta
          suppressHydrationWarning
          name="last-modified"
          content={getStartOfDay().toISOString()}
        />
        {target ? <base target={target} /> : null}
      </Head>
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: title,
          description: description,
          url: thisUrl,
          image: { '@type': 'ImageObject', url: image },
        }}
      />
      {/* Sitewide Organization entity (name, logo, sameAs profiles) so search
          engines and answer engines can resolve ChatBotKit as a known entity on
          every page. Shares its @id with the per-landing Organization nodes. */}
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          ...organization,
        }}
      />
    </>
  )
}

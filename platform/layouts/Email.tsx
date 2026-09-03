/* eslint-disable custom-eslint-rules/no-restricted-client-imports -- emails render on the server where the values resolve from the runtime environment */
'use client'

import * as React from 'react'
import { createContext, useContext, useMemo } from 'react'
import {
  type BodyProps,
  type ButtonProps,
  type ContainerProps,
  Head,
  type HeadingProps,
  Html,
  type ImgProps,
  type LinkProps,
  type MarkdownProps,
  Preview,
  type TextProps,
  Body as _Body,
  Button as _Button,
  Container as _Container,
  Heading as _Heading,
  Hr as _Hr,
  Img as _Img,
  Link as _Link,
  Markdown as _Markdown,
  Text as _Text,
} from 'react-email'

import { siteUrl } from '@/config/site'

import { getRandomId } from '@/lib/string'

/**
 * Generic email branding descriptor passed by callers (partner, portal, or any
 * future branded context). Kept intentionally minimal - just what the email
 * layout needs to render the header and decide whitelabel suppression.
 */
export interface EmailBranding {
  /** Stable identifier used as part of the rate-limit key. */
  id: string
  /** Display name shown in the email header and sign-off. */
  name: string
  /** URL of a square icon image (preferred over logo for the compact slot). */
  icon?: string
  /** URL of a full logo image. */
  logo?: string
  /** Base URL used for action links (e.g. dashboard button). */
  baseUrl?: string
  /** When true, suppresses CBK-specific feedback blocks. */
  whitelabel?: boolean
}

export const Hr = _Hr

// ---------------------------------------------------------------------------
// Campaign Context
// ---------------------------------------------------------------------------

export interface Campaign {
  id?: string
  name?: string
  source?: string
  medium?: string
}

export interface UnsubscribeProps {
  unsubscribe?: string | null
  preferences?: string | null
}

const campaignContext = createContext<Campaign | undefined>(undefined)

// ---------------------------------------------------------------------------
// Heading
// ---------------------------------------------------------------------------

export function Heading({
  style,
  children,
  ...props
}: HeadingProps): React.JSX.Element {
  return (
    <_Heading
      style={{ fontSize: '1.2rem', lineHeight: '2rem', ...style }}
      {...props}
    >
      {children}
    </_Heading>
  )
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export function Text({
  style,
  children,
  ...props
}: TextProps): React.JSX.Element {
  return (
    <_Text style={{ fontSize: '1rem', ...style }} {...props}>
      {children}
    </_Text>
  )
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

export function Markdown({
  children: initialChildren,
  ...props
}: MarkdownProps): React.JSX.Element {
  const campaign = useContext(campaignContext)

  const children = useMemo(() => {
    if (typeof initialChildren !== 'string') {
      return initialChildren
    }

    let result = initialChildren

    // @note strip video embeds - mail clients cannot play them. Content refs
    // are relative, but absolute ones survive when markdown is pre-resolved
    result = result.replace(
      /!\[\]\((?:https:\/\/chatbotkit\.com)?\/media\/[^)]*?\.(?:mp4|webm|mov)\)/g,
      // '<video width="600" height="300" src="$1" controls></video>'
      ''
    )

    result = result.replace(
      /\]\((?<!\!)(https?:\/\/[^)]+)\)/g,
      (match, url: string) => {
        try {
          const utmUrl = new URL(url)

          utmUrl.searchParams.set('utm_source', campaign?.source || 'email')
          utmUrl.searchParams.set('utm_medium', campaign?.medium || 'email')
          utmUrl.searchParams.set('utm_campaign', campaign?.name || 'email')
          utmUrl.searchParams.set('utm_id', campaign?.id || getRandomId())

          return `](${utmUrl.toString()})`
        } catch {
          return match
        }
      }
    )

    return result
  }, [initialChildren, campaign])

  return (
    <_Markdown
      markdownCustomStyles={{
        h1: { fontSize: '24px', fontWeight: 'bold' },
        h2: { fontSize: '22px', fontWeight: 'bold' },
        h3: { fontSize: '20px', fontWeight: 'bold' },
        h4: { fontSize: '18px', fontWeight: 'bold' },
        h5: { fontSize: '16px', fontWeight: 'bold' },
        h6: { fontSize: '14px', fontWeight: 'bold' },
      }}
      {...props}
    >
      {children}
    </_Markdown>
  )
}

// ---------------------------------------------------------------------------
// Img
// ---------------------------------------------------------------------------

export function Img({ src, style, ...props }: ImgProps): React.JSX.Element {
  let resolvedSrc = src

  try {
    if (typeof src === 'string' || src === undefined) {
      resolvedSrc = new URL(src ?? '', siteUrl).toString()
    }
  } catch {
    // pass
  }

  return <_Img src={resolvedSrc} style={{ ...style }} {...props} />
}

// ---------------------------------------------------------------------------
// Link
// ---------------------------------------------------------------------------

export function Link({
  href,
  style,
  children,
  ...props
}: LinkProps): React.JSX.Element {
  let resolvedHref = href ?? ''

  try {
    if (!resolvedHref.startsWith('<%')) {
      resolvedHref = new URL(resolvedHref, siteUrl).toString()
    }
  } catch {
    // pass
  }

  const campaign = useContext(campaignContext)

  if (/^https?:\/\//.test(resolvedHref)) {
    const url = new URL(resolvedHref)

    url.searchParams.set('utm_source', campaign?.source || 'email')
    url.searchParams.set('utm_medium', campaign?.medium || 'email')
    url.searchParams.set('utm_campaign', campaign?.name || 'email')
    url.searchParams.set('utm_id', campaign?.id || getRandomId())

    resolvedHref = url.toString()
  }

  return (
    <_Link
      href={resolvedHref}
      style={{ color: 'rgb(99, 102, 241)', ...style }}
      {...props}
    >
      {children}
    </_Link>
  )
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

export function Button({
  href,
  style,
  children,
  ...props
}: ButtonProps): React.JSX.Element {
  let resolvedHref = href ?? ''

  try {
    if (!resolvedHref.startsWith('<%')) {
      resolvedHref = new URL(resolvedHref, siteUrl).toString()
    }
  } catch {
    // pass
  }

  const campaign = useContext(campaignContext)

  if (/^https?:\/\//.test(resolvedHref)) {
    const url = new URL(resolvedHref)

    url.searchParams.set('utm_source', campaign?.source || 'email')
    url.searchParams.set('utm_medium', campaign?.medium || 'email')
    url.searchParams.set('utm_campaign', campaign?.name || 'email')
    url.searchParams.set('utm_id', campaign?.id || getRandomId())

    resolvedHref = url.toString()
  }

  return (
    <_Button
      href={resolvedHref}
      style={{
        backgroundColor: '#6366f1',
        color: '#ffffff',
        borderRadius: '9999px',
        display: 'inline-block',
        paddingLeft: '0.75rem',
        paddingRight: '0.75rem',
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem',

        ...style,
      }}
      {...props}
    >
      {children}
    </_Button>
  )
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export function Section({
  children,
}: {
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      style={{
        marginTop: '40px',
        marginBottom: '40px',
      }}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export function Feedback({
  children,
}: {
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      {children}
      <div>
        <Button href="https://formshare.ai/s/q6cGp46Q15">
          Send feedback with FormShare.ai
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Unsubscribe
// ---------------------------------------------------------------------------

export function Unsubscribe({
  unsubscribe,
  preferences,
}: UnsubscribeProps): React.JSX.Element {
  const items: (React.ReactElement | string)[] = []

  if (unsubscribe !== null) {
    items.push(
      <Link
        key="unsubscribe"
        style={{ color: '#cecece', fontSize: '12px' }}
        href="<%asm_group_unsubscribe_raw_url%>"
      >
        {unsubscribe || 'Unsubscribe'}
      </Link>
    )
  }

  if (preferences !== null) {
    items.push(
      <Link
        key="preferences"
        style={{ color: '#cecece', fontSize: '12px' }}
        href="<%asm_preferences_raw_url%>"
      >
        {preferences || 'Manage Preferences'}
      </Link>
    )
  }

  for (let i = 1; i < items.length; i += 2) {
    items.splice(i, 0, ' | ')
  }

  return <Text style={{ color: '#cecece', fontSize: '12px' }}>{items}</Text>
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

export function Body({
  children,
}: Pick<BodyProps, 'children'>): React.JSX.Element {
  return (
    <_Body
      style={{
        backgroundColor: '#ffffff',
        marginLeft: 'auto',
        marginRight: 'auto',
        fontFamily: 'sans-serif',
      }}
    >
      {children}
    </_Body>
  )
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

export function Container({
  children,
  wide,
}: Pick<ContainerProps, 'children'> & { wide?: boolean }): React.JSX.Element {
  return (
    <_Container
      style={{
        border: '1px solid #eaeaea',
        borderRadius: '0.5rem',
        marginLeft: 'auto',
        marginRight: 'auto',
        marginTop: '40px',
        marginBottom: '40px',
        padding: '20px',

        ...(wide ? { maxWidth: '650px' } : { maxWidth: '465px' }),
      }}
    >
      {children}
    </_Container>
  )
}

// ---------------------------------------------------------------------------
// BrandedEmail
// ---------------------------------------------------------------------------

/**
 * Discriminated union describing how the email header brand should be rendered.
 *
 * - `icon` - small square image alongside a text label (default CBK style)
 * - `logo` - full logo image only, no label (partner has a standalone logo)
 * - `text` - no image, label text only (partner has neither icon nor logo)
 */
export type BrandHeader =
  | { mode: 'icon'; src: string; alt: string; label: string }
  | { mode: 'logo'; src: string; alt: string }
  | { mode: 'text'; label: string }

/**
 * Resolves the correct brand header configuration given an optional partner.
 * Partners with an icon use icon mode (image + label). Partners with only a
 * logo use logo mode (image only). Partners with neither fall back to text
 * mode. When no partner is provided the default CBK branding is returned.
 */
export function resolveBrandHeader(branding?: EmailBranding): BrandHeader {
  if (!branding) {
    return {
      mode: 'icon',
      src: `${siteUrl}/icon.png`,
      alt: 'ChatBotKit',
      label: 'CBK',
    }
  }

  // @note icon is preferred over logo for the compact square header slot
  if (branding.icon) {
    return {
      mode: 'icon',
      src: branding.icon,
      alt: branding.name,
      label: branding.name,
    }
  }

  if (branding.logo) {
    return { mode: 'logo', src: branding.logo, alt: branding.name }
  }

  return { mode: 'text', label: branding.name }
}

export interface BrandedEmailProps {
  preview?: string
  wide?: boolean
  generic?: boolean
  feedback?: boolean
  unsubscribe?: UnsubscribeProps
  campaign?: Campaign
  branding?: EmailBranding
  children?: React.ReactNode
}

export function BrandedEmail({
  preview,
  wide,
  generic,
  feedback,
  unsubscribe,
  campaign,
  branding,
  children,
}: BrandedEmailProps): React.JSX.Element {
  const brand = resolveBrandHeader(branding)

  // @note feedback is a CBK-specific feature suppressed for whitelabel
  // partners

  const showFeedback = feedback && !branding?.whitelabel

  return (
    <campaignContext.Provider value={campaign}>
      <Html lang="en">
        <Head />
        {preview ? <Preview>{preview}</Preview> : null}
        <Body>
          <Container wide={wide}>
            {!generic ? (
              <Text>
                {brand.mode !== 'text' ? (
                  <Img
                    width="25px"
                    height="25px"
                    src={brand.src}
                    alt={brand.alt}
                    style={{ display: 'inline', verticalAlign: 'middle' }}
                  />
                ) : null}
                {brand.mode !== 'logo' ? (
                  <span
                    style={{
                      display: 'inline',
                      marginLeft: brand.mode !== 'text' ? '10px' : undefined,
                      fontWeight: 'bold',
                      fontSize: '20px',
                      lineHeight: '25px',
                      verticalAlign: 'middle',
                    }}
                  >
                    {brand.label}
                  </span>
                ) : null}
              </Text>
            ) : null}
            <div style={{ marginTop: '40px' }}>{children}</div>
            {showFeedback ? (
              <Feedback>
                <Hr />
              </Feedback>
            ) : null}
          </Container>
          <div style={{ textAlign: 'center' }}>
            {unsubscribe ? <Unsubscribe {...unsubscribe} /> : null}
          </div>
        </Body>
      </Html>
    </campaignContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// BasicEmail
// ---------------------------------------------------------------------------

export interface BasicEmailProps {
  preview?: string
  unsubscribe?: UnsubscribeProps
  campaign?: Campaign
  children?: React.ReactNode
}

export function BasicEmail({
  preview,
  unsubscribe,
  campaign,
  children,
}: BasicEmailProps): React.JSX.Element {
  return (
    <campaignContext.Provider value={campaign}>
      <Html lang="en">
        <Head />
        {preview ? <Preview>{preview}</Preview> : null}
        <Body>
          {children}
          {unsubscribe ? <Unsubscribe {...unsubscribe} /> : null}
        </Body>
      </Html>
    </campaignContext.Provider>
  )
}

export default BasicEmail

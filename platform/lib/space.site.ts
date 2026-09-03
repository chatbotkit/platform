import { spaceApex } from '@/config/apexes'

import { throwBadRequest } from '@/lib/response'

/**
 * The apex under which platform-issued static-site subdomains live - a
 * SpaceSite is reachable at `<slug>.<apex>`. It comes from the deployment's
 * SPACE_APEX deployment variable; without one the feature refuses to mint or
 * validate hostnames, because it could only ever mint names the operator does
 * not control.
 */
export const SPACE_SITE_APEX: string | undefined = spaceApex

/**
 * Slugs that may never be claimed as a space-site subdomain. These
 * are either operationally significant (mail, ns*, ...) or would shadow other
 * platform surfaces (app, api, hub, ...).
 */
const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'apps',
  'assets',
  'blog',
  'cdn',
  'chat',
  'dashboard',
  'docs',
  'ftp',
  'help',
  'hub',
  'labs',
  'mail',
  'ns',
  'ns1',
  'ns2',
  'portal',
  'smtp',
  'static',
  'status',
  'support',
  'www',
])

// RFC 1123 label: 1-63 chars, alphanumerics and hyphens, no leading/trailing
// hyphen.
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/**
 * Returns the slug for a `*.<space apex>` host, or `null` when the host is not
 * under the space-site apex. A multi-level host such as `a.b.<apex>` is
 * rejected because a site slug always occupies exactly one DNS label.
 */
export function getSpaceSiteSlug(host: string): string | null {
  if (!SPACE_SITE_APEX) {
    return null
  }

  const suffix = `.${SPACE_SITE_APEX}`

  if (!host.endsWith(suffix)) {
    return null
  }

  const slug = host.slice(0, -suffix.length)

  return slug && !slug.includes('.') ? slug : null
}

export function isReservedSpaceSiteSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug)
}

/**
 * Normalizes a user-supplied site slug before validation and persistence.
 */
export function normalizeSpaceSiteSlug(input: string): string {
  return (input || '').trim().toLowerCase()
}

/**
 * Validates a SpaceSite slug and throws a bad-request error when it cannot be
 * used as the single subdomain label beneath the configured space apex.
 */
export function assertSpaceSiteSlug(slug: string): void {
  if (!SPACE_SITE_APEX) {
    throwBadRequest(
      'Space sites are not configured on this deployment (SPACE_APEX is not set)'
    )

    return
  }

  if (!SLUG_PATTERN.test(slug)) {
    throwBadRequest('Slug must be a valid DNS label')

    return
  }

  if (isReservedSpaceSiteSlug(slug)) {
    throwBadRequest('This slug is reserved')
  }
}

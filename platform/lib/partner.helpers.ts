import '@/lib/scope.server'

import partnersConfig from '@chatbotkit-dev/partners'

import { partnersApex } from '@/config/apexes'
import { siteUrl } from '@/config/site'

import type { EmailBranding } from '@/layouts/Email'

export type Partner = (typeof partnersConfig)[string]

/**
 * Converts a partner config entry into the generic EmailBranding descriptor
 * used by email templates and notification helpers.
 */
export function partnerToEmailBranding(partner: Partner): EmailBranding {
  return {
    id: partner.id,

    name: partner.name,

    logo: partner.logo,
    icon: partner.icon,

    // @note a partner without a custom domain lives under the deployment's
    // partners apex; without one there is no partner host to point at, so
    // the branding falls back to the site itself

    baseUrl: partner.domain
      ? `https://${partner.domain}`
      : partnersApex
        ? `https://${partner.id}.${partnersApex}`
        : siteUrl,

    whitelabel: partner.whitelabel,
  }
}

export async function getPartnerByIdentifier(
  idOrSlug: string
): Promise<Partner | null> {
  const partner =
    partnersConfig[idOrSlug] ||
    Object.values(partnersConfig).find((partner) => partner.id === idOrSlug)

  if (!partner) {
    return null
  }

  return partner
}

export async function getPartnerByHostname(
  hostname: string
): Promise<Partner | null> {
  const slug = getPartnerSlugFromHostname((hostname || '').split(':')[0])

  if (!slug) {
    return null
  }

  return getPartnerByIdentifier(slug)
}

export function getPartnerSlugFromHostname(hostname: string): string | null {
  const partnerEntry = Object.entries(partnersConfig).find(
    ([, partner]) => partner.domain && partner.domain === hostname
  )

  if (partnerEntry) {
    return partnerEntry[0]
  }

  if (!partnersApex) {
    return null
  }

  const match = hostname.match(
    new RegExp(`^(?<slug>.+?)\\.${partnersApex.replace(/\./g, '\\.')}$`)
  )

  if (!match) {
    return null
  }

  const slug = match.groups?.slug

  if (!slug) {
    return null
  }

  if (slug in partnersConfig) {
    return slug
  }

  return null
}

export function isPartnerHost(host: string): boolean {
  return getPartnerSlugFromHostname(host) !== null
}

import { portalApex } from '@/config/apexes'
import { siteUrl } from '@/config/site'

import { getPortalGlobalConfig } from '@/lib/portal.config'
import { getExternalFrontendHostURL } from '@/lib/host'

type PortalIdentity = {
  slug: string
  userId: string
}

/**
 * Gets the portal origin, including the deployment's scheme and port.
 */
export async function getPortalFrontendURL(portal: PortalIdentity): Promise<string> {
  // @note a partner portal configuration may name a custom domain; resolving
  // it through the portal owner prevents an unrelated account from claiming
  // the mapping by choosing a matching slug

  const config = await getPortalGlobalConfig(portal)

  const domain = typeof config?.domain === 'string' ? config.domain : undefined

  if (domain) {
    const suffix = `-${domain.replaceAll('.', '-')}`

    const prefix = portal.slug.endsWith(suffix)
      ? portal.slug.slice(0, -suffix.length)
      : portal.slug

    const host = prefix ? `${prefix}.${domain}` : domain

    return new URL(getExternalFrontendHostURL('/', host)).origin
  }

  // @note the default pattern uses the deployment's portal apex, falling back
  // to the site host itself when no apex is configured - a controlled name is
  // better than minting one the operator does not own

  const site = new URL(siteUrl)
  const host = portalApex
    ? `${portalApex}${site.port ? `:${site.port}` : ''}`
    : site.host

  return new URL(`${site.protocol}//${portal.slug}.${host}`).origin
}

/**
 * Gets the portal host for request context and hostname lookups.
 */
export async function getPortalFrontendHost(portal: PortalIdentity): Promise<string> {
  return new URL(await getPortalFrontendURL(portal)).host
}

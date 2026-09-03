import { portalApex } from '@/config/apexes'
import { siteHostname } from '@/config/site'

import { getPortalGlobalConfig } from '@/lib/portal.config'

/**
 * Get frontend host from portal object
 */
export async function getPortalFrontendHost(portal: {
  slug: string
  userId: string
}): Promise<string> {
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

    return prefix ? `${prefix}.${domain}` : domain
  }

  // @note the default pattern uses the deployment's portal apex, falling back
  // to the site host itself when no apex is configured - a controlled name is
  // better than minting one the operator does not own

  return `${portal.slug}.${portalApex ?? siteHostname}`
}

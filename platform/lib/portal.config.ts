import type { PartnerPortal, PartnerPortals } from '@chatbotkit-dev/partners-spec'

import { getEffectivePartner } from '@/lib/user.type'
import { fastGetUserById } from '@/lib/user.get'

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getConfigBySlug(
  portals: PartnerPortals,
  slug: string
): PartnerPortal | null {
  return (
    Object.entries(portals).find(([pattern]) => {
      const expression = pattern.split('*').map(escapeRegex).join('.+?')

      return new RegExp(`^${expression}$`).test(slug)
    })?.[1] ?? null
  )
}

/**
 * Resolve shared configuration for a portal from its owner's partner entry.
 * Matching the configured slug pattern is not sufficient: the portal must be
 * owned by that partner account or one of its child accounts.
 */
export async function getPortalGlobalConfig(portal: {
  slug: string
  userId: string
}): Promise<PartnerPortal | null> {
  const owner = await fastGetUserById(portal.userId)

  if (!owner) {
    return null
  }

  const partner = await getEffectivePartner(owner)

  if (!partner?.portals) {
    return null
  }

  return getConfigBySlug(partner.portals, portal.slug)
}

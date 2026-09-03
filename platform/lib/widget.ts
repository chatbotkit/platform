import limits from '@/config/limits'

import { revealUserPlan } from '@/lib/user.plan'
import { getEffectivePartner } from '@/lib/user.type'
import type { User } from '@/lib/user.get'

/**
 * The method checks if the powered by can be disabled for the user.
 *
 * @note a plan entitlement, resolved through the plan catalogue like runner
 * and sandbox sizes - freely available in the planless deployment, where
 * every plan lookup yields the unlimited table.
 */
export async function canDisablePoweredBy(user: User): Promise<boolean> {
  const { plan } = await revealUserPlan(user)

  return limits[plan]?.widgetIntegration?.canDisablePoweredBy === true
}

interface PoweredByDetails {
  caption: string
  url?: string
  logo?: string
}

/**
 * The method gets the brand caption, url and logo.
 *
 * @note a whitelabel partner's users see the partner's brand, taken from the
 * partner catalogue - the same source that brands their emails and dashboard.
 * Everyone else sees the platform brand.
 */
export async function getPoweredByDetails(
  user: User
): Promise<PoweredByDetails> {
  const partner = await getEffectivePartner(user)

  if (partner?.whitelabel) {
    return {
      caption: partner.name,
      url: partner.domain ? `https://${partner.domain}` : process.env.SITE_URL,
      logo: partner.logo,
    }
  }

  return {
    caption: 'ChatBotKit',
    url: process.env.SITE_URL,
  }
}

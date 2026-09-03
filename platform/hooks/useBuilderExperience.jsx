import { resolveBuilderExperience } from '@/lib/experience'

import useHostname from '@/hooks/useHostname'
import usePartner from '@/hooks/usePartner'
import useSearchParam from '@/hooks/useSearchParam'

export const EXPERIENCE_SEARCH_PARAM = '_experience'

/**
 * Reports whether the dashboard is serving the builder experience: the
 * focused agent-builder surface shown on chatbotkit.com. Its complement is
 * usePlatformExperience - the full platform surface shown everywhere else
 * (previews, local development, and partner hosts). See the public architecture
 * guide and buildMenu in layouts/Dashboard.jsx.
 *
 * The experience resolves in three steps, most specific first:
 *
 * 1. The `_experience` search param forces it regardless of the host -
 *    `?_experience=builder` or `?_experience=platform` - which makes both
 *    experiences testable from any environment.
 * 2. A partner may pin the experience its host serves, via the `experience`
 *    option in config/partners.js. Partners differ in how technical their
 *    audience is, so this is a per-partner fact rather than something the
 *    hostname or the whitelabel flag can imply.
 * 3. Otherwise the hostname decides, which means the full platform experience
 *    for every host but chatbotkit.com.
 *
 * @note the platform experience is the default because it is the superset: a
 * host that should have been narrowed only gets a busier menu, whereas a wrong
 * builder default would silently hide the platform primitives from someone who
 * needs them.
 *
 * @note neither the force nor the partner option reaches code that resolves the
 * experience outside React (the onboarding template steps via
 * getDocumentHostname) - a known, accepted limitation.
 */
export default function useBuilderExperience() {
  const hostname = useHostname()

  const partner = usePartner()

  const forcedExperience = useSearchParam(EXPERIENCE_SEARCH_PARAM)

  if (forcedExperience === 'builder') {
    return true
  }

  if (forcedExperience === 'platform') {
    return false
  }

  return resolveBuilderExperience({
    partnerExperience: partner?.experience,
    hostname,
  })
}

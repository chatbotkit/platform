import { siteUrl } from '@/config/site'

export function getExperienceHostname(hostname?: string | null): string {
  const fallbackHostname = new URL(siteUrl).hostname
  const [firstHostname] = (hostname || fallbackHostname).split(',')

  return firstHostname?.trim().split(':')[0] || fallbackHostname
}

// @note which hostnames serve the builder experience is deployment
// configuration, not code: EXPERIENCE_BUILDER_HOSTS is a comma-separated
// list of hostnames, each either exact (`example.com`) or a wildcard
// subdomain pattern (`*.example.com` - subdomains only, not the apex).
// Unset, no host serves the builder experience and the deployment is all
// platform - the right default for self-hosting.
// @note resolved per call rather than at import so the value follows the
// environment - which also keeps the test suites able to pin fixtures
function getBuilderHosts(): string[] {
  return (process.env.EXPERIENCE_BUILDER_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
}

export function isBuilderExperienceHostname(hostname?: string | null): boolean {
  const normalizedHostname = getExperienceHostname(hostname)
    .toLowerCase()
    .replace(/\.$/, '')

  return getBuilderHosts().some((host) =>
    host.startsWith('*.')
      ? normalizedHostname.endsWith(host.slice(1))
      : normalizedHostname === host
  )
}

export function isPlatformExperienceHostname(
  hostname?: string | null
): boolean {
  return !isBuilderExperienceHostname(hostname)
}

export type Experience = 'builder' | 'platform'

/**
 * Resolves the experience from a partner's pinned `experience` option, falling
 * back to the hostname when the partner does not pin one. The single precedence
 * rule shared by every consumer - useBuilderExperience for React, the onboarding
 * template for the plain document - so the two can never disagree.
 */
export function resolveBuilderExperience({
  partnerExperience,
  hostname,
}: {
  partnerExperience?: Experience | string | null
  hostname?: string | null
}): boolean {
  if (partnerExperience) {
    return partnerExperience === 'builder'
  }

  return isBuilderExperienceHostname(hostname)
}

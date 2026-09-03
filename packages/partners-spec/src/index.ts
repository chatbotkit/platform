// @note the partner catalogue contract. These types describe what a partner
// entry is, not which partners exist: the catalogue itself is the swappable
// part and lives in @chatbotkit-dev/partners.

/**
 * PARTNER
 */

/**
 * A fully rendered message, ready to deliver. The platform renders both parts
 * before handing it off - whether a body started life as markdown, HTML or a
 * React element is the platform's business and not a transport's.
 */
export type PartnerEmailMessage = {
  to: string
  subject: string
  text: string
  html: string
}

/**
 * How a partner's transactional email leaves the platform. A partner without
 * this sends through the platform's own configured email module, which is the
 * right default for anyone who is not white-labelling.
 *
 * @note this is the delivery implementation, not the name of a vendor. A
 * whitelabel partner sends as an identity the platform does not own - its own
 * domain - so the catalogue names that identity and supplies something that can
 * send through it. The platform renders the message and calls `send`.
 *
 * Delivering under a hosted name is a capability of the deployment's email
 * module, which is where the vendor and its credentials live - see
 * `createEmailTransport` in @chatbotkit-dev/email-spec. Nothing about it reaches
 * the platform.
 */
export type PartnerEmail = {
  send(message: PartnerEmailMessage): Promise<void>
}

export type PartnerAuth = {
  /**
   * Lets an account that exists on the main platform sign in through this
   * partner's host. Off by default: a partner host normally only knows its own
   * users, and letting any platform account in makes the partner's
   * dashboard reachable by users the partner has never seen.
   */
  allowGlobalLogin?: boolean
}

/**
 * The dashboard experience a partner host serves. Omit it to let the hostname
 * decide - which means the full platform experience for every partner domain.
 * See useBuilderExperience and the public architecture guide.
 */
export type PartnerExperience = 'builder' | 'platform'

export interface PartnerPortalApp {
  [key: string]: unknown
}

export interface PartnerPortalUser {
  [key: string]: unknown
}

export interface PartnerPortalGroup {
  users?: Record<string, PartnerPortalUser>
  apps?: Record<string, PartnerPortalApp>
}

/**
 * Shared configuration for portals owned by one partner. The key in
 * `PartnerPortals` selects portals by slug and may contain `*` as a wildcard.
 */
export interface PartnerPortal {
  _?: {
    apps: Record<string, PartnerPortalApp>
  }
  apps?: Record<string, PartnerPortalApp>
  users?: Record<string, PartnerPortalUser>
  groups?: Record<string, PartnerPortalGroup>

  /**
   * Custom apex for matching portals. The slugified apex is removed from the
   * portal slug and the remaining prefix becomes its subdomain.
   */
  domain?: string

  [key: string]: unknown
}

export type PartnerPortals = Record<string, PartnerPortal>

export type Partner = {
  /**
   * The id of the partner account. Partner accounts are recognised by having
   * an id ending in this one - see isPartnerAccount in
   * platform/lib/user.type.ts.
   */
  id: string

  name: string

  /**
   * Image URLs, not package assets - absolute, or site-relative when the
   * deployment's own public directory serves them. Partner surfaces and
   * emails render on many hosts, so absolute URLs are the safe choice.
   */
  logo?: string
  icon?: string

  /**
   * A custom host this partner is served on, without scheme or port. A partner
   * without one is served on `<slug>.chatbotkit.partners`, where the slug is
   * this entry's key in the catalogue.
   *
   * @note a domain may belong to at most one partner. Two entries claiming the
   * same host cannot both be resolved.
   */
  domain?: string

  /**
   * Removes ChatBotKit's own branding from everything the partner's users see,
   * including billing emails and notifications. A whitelabel partner is
   * expected to carry `logo`, `icon` and `email` as well - with none of them
   * there is nothing to brand with, and its users would receive unbranded mail
   * from an address they do not recognise.
   */
  whitelabel?: boolean

  experience?: PartnerExperience
  auth?: PartnerAuth
  email?: PartnerEmail

  /**
   * Shared portal configuration available only to this partner account and
   * its child accounts. An unrelated account cannot claim it by choosing a
   * matching portal slug.
   */
  portals?: PartnerPortals
}

/**
 * The catalogue, keyed by slug. The slug is part of the partner's public
 * surface: it names the `<slug>.chatbotkit.partners` host and appears in the
 * `/partner/signin/<slug>` routes, so it is not safe to rename once a partner
 * is live.
 */
export type Partners = Record<string, Partner>

/**
 * Throws when this catalogue is not usable with the current environment.
 *
 * @note the convention every swappable module follows. See
 * packages/AGENTS.md. An implementation with nothing to misconfigure
 * should resolve.
 */
export type AssertConfigured = () => Promise<void>

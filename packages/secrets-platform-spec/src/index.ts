// @note these types describe the platform secret catalogue: the credentials a
// hosted deployment offers on behalf of its users, so that a user does not have
// to register their own OAuth application for a supported service.
//
// The community catalogue is deliberately empty. A deployment that wants to
// offer platform hosted credentials supplies its own implementation of this
// package. See README.md.

export interface CoreOauthConfig {
  clientId: string // @note encrypted credential
  clientSecret: string // @note encrypted credential

  revokeUrl?: string
  infoUrl?: string
  validateUrl?: string
  scope?: string
}

export interface AuthorizationCodeOauthConfig extends CoreOauthConfig {
  authorizationUrl: string
  tokenUrl: string
  grantType?: 'authorization_code'
}

export interface ClientCredentialsGrantOauthConfig extends CoreOauthConfig {
  tokenUrl: string
  grantType: 'client_credentials'
}

export type OauthConfig =
  | AuthorizationCodeOauthConfig
  | ClientCredentialsGrantOauthConfig

// @note a secret kind that carries no configuration at all; an interface so
// the kinds that do carry one can extend the same shape
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface EmptyConfig {}

export interface CoreSecret {
  _production?: unknown
  _production_dev?: unknown
  _staging?: unknown
  _staging_dev?: unknown
  _development?: unknown
  _development_dev?: unknown

  icon?: string

  name: string
  description: string

  type: 'plain' | 'basic' | 'bearer'

  kind?: 'shared' | 'personal'

  config?: EmptyConfig

  productionConfig?: Partial<EmptyConfig>
  stagingConfig?: Partial<EmptyConfig>
  developmentConfig?: Partial<EmptyConfig>

  commentary?: string
  setup?: string

  tags?: string[]
}

export interface OAuthSecret extends Omit<CoreSecret, 'type' | 'config'> {
  type: 'oauth'
  config: OauthConfig

  productionConfig?: Partial<OauthConfig>
  stagingConfig?: Partial<OauthConfig>
  developmentConfig?: Partial<OauthConfig>
}

export type Secret = CoreSecret | OAuthSecret

export type PlatformSecretCatalogue = Record<string, Secret>

/**
 * The entry a platform secret contributes to the standard catalogue, so users
 * can pick it. It is fully derived from the platform entry: nothing here is
 * authored separately.
 */
export interface StandardTemplateEntry {
  icon?: string

  name: string
  description: string

  kind?: 'shared' | 'personal'

  tags?: string[]

  type: 'template'

  config: {
    template: string
  }
}

export type StandardTemplateEntries = Record<string, StandardTemplateEntry>

/**
 * Throws when the installed catalogue is not usable with the current
 * configuration.
 *
 * @note the same convention every swappable module in this repository follows:
 * configuration is resolved lazily so that importing a module never requires a
 * vendor's credentials, and a deployment calls this where its environment is
 * loaded to find out at build time rather than at first use.
 *
 * An implementation needing no configuration should resolve.
 */
export type AssertConfigured = () => Promise<void>

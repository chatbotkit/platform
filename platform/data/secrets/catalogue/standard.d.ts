declare module '@/data/secrets/catalogue/standard.yaml' {
  export interface CoreOauthConfig {
    clientId: '' // @note deliberately empty string
    clientSecret: '' // @note deliberately empty string

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

  export interface McpOauthConfig {
    resourceUrl: string
    clientId?: ''
    clientSecret?: ''
  }

  export type OauthConfig =
    | AuthorizationCodeOauthConfig
    | ClientCredentialsGrantOauthConfig
    | McpOauthConfig

  interface TemplateConfig {
    template: string
  }

  interface EmptyConfig {
    // pass
  }

  export interface CoreSecret {
    icon?: string

    name: string
    description: string

    kind?: 'shared' | 'personal'

    commentary?: string
    setup?: string

    tags?: string[]
  }

  export interface PlainSecret extends CoreSecret {
    type: 'plain'
    config?: EmptyConfig
  }

  export interface BasicSecret extends CoreSecret {
    type: 'basic'
    config?: EmptyConfig
  }

  export interface BearerSecret extends CoreSecret {
    type: 'bearer'
    config?: {
      scheme?: string
    }
  }

  export interface JwtSecret extends CoreSecret {
    type: 'jwt'
    config?: {
      algorithm?: string
      expiresInSeconds?: number
      claims?: Record<string, unknown>
      schema?: string
    }
  }

  export interface OAuthSecret extends CoreSecret {
    type: 'oauth'
    config: OauthConfig
  }

  export interface TemplateSecret extends CoreSecret {
    type: 'template'
    config: TemplateConfig
  }

  export type Secret =
    | PlainSecret
    | BasicSecret
    | BearerSecret
    | JwtSecret
    | OAuthSecret
    | TemplateSecret

  const secrets: Record<string, Secret>

  export default secrets
}

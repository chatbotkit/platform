declare global {
  namespace PrismaJson {
    type Json = unknown

    type JsonObject = object
    type JsonArray = unknown[]

    type JsonRecord = Record<string, unknown>

    type OAuthScopes = string[]
    type OAuthGrants = string[]
    type OAuthRedirectUris = string[]

    type Meta = Record<string, unknown>

    type Limits = Record<string, unknown>
  }
}

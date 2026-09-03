import SchemaBuilder from '@pothos/core'

/**
 * Context interface for the auxiliary GraphQL schema.
 * Contains authentication session and caller information.
 */
export interface Context {
  session?: {
    user?: {
      id?: string | null
      email?: string | null
      name?: string | null
    } | null
  } | null
  caller?: string | null
}

/**
 * Shared schema builder instance for all auxiliary service schemas.
 * This builder is used across notion.ts, slack.ts, and other service modules.
 */
export const builder = new SchemaBuilder<{
  Context: Context
}>({})

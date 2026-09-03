import { builder } from './builder'
// @note import all service schemas to register their types
import { NotionNamespace } from './notion'
import { SlackNamespace } from './slack'

// @note create the root query type
builder.queryType({
  fields: (t) => ({
    // @note notion namespace for all notion-related queries
    notion: t.field({
      type: NotionNamespace,
      resolve: () => ({}),
    }),

    // @note slack namespace for all slack-related queries
    slack: t.field({
      type: SlackNamespace,
      resolve: () => ({}),
    }),

    // @todo add additional auxiliary service namespaces here
  }),
})

// @note create the root mutation type
builder.mutationType({
  fields: (t) => ({
    // @note notion namespace for all notion-related mutations
    notion: t.field({
      type: NotionNamespace,
      resolve: () => ({}),
    }),

    // @note slack namespace for all slack-related mutations
    slack: t.field({
      type: SlackNamespace,
      resolve: () => ({}),
    }),

    // @todo add additional auxiliary service namespaces here
  }),
})

/**
 * Build and export the final GraphQL schema.
 * This schema combines all auxiliary service schemas into a single executable schema.
 */
export const schema = builder.toSchema()

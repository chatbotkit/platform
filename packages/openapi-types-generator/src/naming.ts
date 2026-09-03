/**
 * Naming utilities for converting OpenAPI operationIds to type names.
 */

// @note integration types that have special operationId patterns
// @todo do it generically
const INTEGRATION_TYPES = [
  'Widget',
  'Slack',
  'Discord',
  'WhatsApp',
  'Messenger',
  'Telegram',
  'Twilio',
  'Sitemap',
  'Notion',
  'McpServer',
  'Instagram',
  'Extract',
  'Support',
]

/**
 * Converts a verb-first operationId to a noun-first type name for better grouping.
 *
 * This swaps the verb and noun parts of camelCase operationIds so that
 * related types group together alphabetically by resource.
 *
 * Examples:
 * - `createBot` → `BotCreate`
 * - `fetchBot` → `BotFetch`
 * - `listBots` → `BotList`
 * - `completeConversation` → `ConversationComplete`
 * - `completeConversationMessage` → `ConversationMessageComplete`
 *
 * Special handling for integrations:
 * - `createDiscordIntegration` → `IntegrationDiscordCreate`
 * - `listSlackIntegrations` → `IntegrationSlackList`
 *
 * @note operationIds stay verb-first (idiomatic for APIs) while generated
 * types become noun-first (better for IDE autocomplete and grouping).
 */
export function operationIdToTypeName(operationId: string): string {
  // @note check for integration pattern: <verb><Type>Integration(s)
  const integrationMatch = operationId.match(
    /^([a-z]+)([A-Z]\w+?)Integrations?$/
  )

  if (integrationMatch) {
    const [, verb, integrationType] = integrationMatch

    // @note only apply special handling for known integration types
    if (INTEGRATION_TYPES.includes(integrationType)) {
      // "createDiscordIntegration" → "IntegrationDiscordCreate"
      return (
        'Integration' +
        integrationType +
        verb.charAt(0).toUpperCase() +
        verb.slice(1)
      )
    }
  }

  // Match verb (lowercase start) followed by noun (uppercase start)
  // e.g., "createBot" → ["createBot", "create", "Bot"]
  // e.g., "completeConversationMessage" → ["completeConversationMessage", "complete", "ConversationMessage"]
  const match = operationId.match(/^([a-z]+)([A-Z].*)$/)

  if (match) {
    const [, verb, noun] = match

    // @note singularize noun for 'list' operations: "listBots" → "BotList" not "BotsList"
    let normalizedNoun = noun

    // @todo use pluralize
    if (verb === 'list') {
      if (noun.endsWith('ies')) {
        // "Abilities" → "Ability"
        normalizedNoun = noun.slice(0, -3) + 'y'
      } else if (noun.endsWith('s') && !noun.endsWith('ss')) {
        // "Bots" → "Bot" (but not "Address" → "Addres")
        normalizedNoun = noun.slice(0, -1)
      }
    }

    // Swap to noun-first: "Bot" + "Create" → "BotCreate"
    return normalizedNoun + verb.charAt(0).toUpperCase() + verb.slice(1)
  }

  // Fallback: just capitalize first letter
  return operationId.charAt(0).toUpperCase() + operationId.slice(1)
}

/**
 * Generates the full type name for a route's request body.
 */
export function getRequestTypeName(operationId: string): string {
  return `${operationIdToTypeName(operationId)}Request`
}

/**
 * Generates the full type name for a route's response.
 */
export function getResponseTypeName(operationId: string): string {
  return `${operationIdToTypeName(operationId)}Response`
}

/**
 * Generates the full type name for a route's JSONL streaming response item.
 */
export function getStreamTypeName(operationId: string): string {
  return `${operationIdToTypeName(operationId)}StreamItem`
}

/**
 * Generates the full type name for a route's parameters (path + query combined).
 */
export function getParamsTypeName(operationId: string): string {
  return `${operationIdToTypeName(operationId)}Params`
}

// @ts-check
import schema from '@/lib/joi.schema'

/**
 * Schema for validating an alias field.
 *
 * Aliases must be:
 * - Lowercase alphanumeric characters, hyphens, and underscores only
 * - At most 128 characters
 * - Unique per user (enforced at the database level)
 *
 * @example
 * - `my-bot`
 * - `production_dataset`
 * - `main-skillset`
 */
export default schema
  .string()
  .allow(null, '')
  .empty('')
  .default(null)
  .max(128)
  .pattern(/^[a-z0-9_-]*$/)
  .messages({
    'string.pattern.base':
      'Alias must contain only lowercase letters, numbers, hyphens, and underscores',
  })

/**
 * @manual Aliases
 * @description Resource aliases provide human-readable identifiers for ChatBotKit resources, enabling easier reference and management.
 * @category API
 * @tags alias, identifier, lookup
 * @index 100
 *
 * Aliases are optional, user-defined identifiers that provide a human-readable way to reference
 * ChatBotKit resources. Instead of using system-generated IDs like `clxyz123abc`, you can assign
 * memorable aliases like `my-production-bot` or `customer-support-dataset` to your resources.
 *
 * ## Supported Resources
 *
 * Aliases are available for the following resource types:
 *
 * - **Bots** - AI chatbot configurations
 * - **Datasets** - Collections of training data and knowledge
 * - **Skillsets** - Sets of abilities and functions
 * - **Files** - Uploaded documents and media
 * - **Secrets** - Secure credential storage
 * - **Spaces** - Organizational workspaces
 * - **Blueprints** - Reusable resource templates
 * - **Portals** - External access points
 *
 * ## Alias Format
 *
 * Aliases must follow these rules:
 *
 * - **Lowercase only** - Use lowercase letters (a-z)
 * - **Alphanumeric** - Letters and numbers (0-9)
 * - **Hyphens and underscores** - Use `-` or `_` as separators
 * - **Maximum length** - Up to 128 characters
 * - **Unique per user** - Each alias must be unique within your account for that resource type
 *
 * Valid examples: `my-bot`, `production_dataset`, `customer-support-v2`, `main-skillset`
 *
 * Invalid examples: `My-Bot` (uppercase), `my bot` (spaces), `my@bot` (special characters)
 *
 * ## Alias Reference Forms
 *
 * In alias-aware API routes, aliases can usually be provided in several forms:
 *
 * - **Own resource alias** - Prefix the alias with `@`, such as `@my-production-bot`
 * - **Parent resource alias** - Prefix the alias with `@@`, such as `@@shared-dataset`
 * - **Sibling resource alias** - Use `@user-alias@resource-alias` to resolve a resource owned by
 *   another user in the same account hierarchy, such as `@operations@handoff-bot`
 *
 * These forms apply anywhere alias-aware lookup is supported.
 *
 * ## Using Aliases for Lookup
 *
 * The most common alias lookup uses the `@` prefix:
 *
 * ```http
 * GET /api/v1/bot/@my-production-bot/fetch
 * ```
 *
 * This is equivalent to looking up by ID:
 *
 * ```http
 * GET /api/v1/bot/clxyz123abc/fetch
 * ```
 *
 * ## Additional Reference Forms
 *
 * Use `@@alias` to reference a resource associated with the parent user context:
 *
 * ```http
 * GET /api/v1/dataset/@@shared-knowledge/fetch
 * ```
 *
 * Use a compound alias when you need to resolve a sibling user's alias first and then look up
 * the resource alias inside that user's scope:
 *
 * ```http
 * GET /api/v1/bot/@operations@handoff-bot/fetch
 * ```
 *
 * This first resolves the sibling user alias `operations`, then resolves the bot alias
 * `handoff-bot` within that user's resources.
 *
 * ## User Lookup Differences
 *
 * User records support `@alias` and `@@alias`, but with one important difference: `@alias`
 * resolves a child User of the current User, and `@@alias` resolves a sibling User through
 * the parent User. The sibling-style `@user@resource` form does not apply to User records.
 *
 * ## Setting an Alias
 *
 * Aliases can be set when creating or updating a resource by including the `alias` field:
 *
 * ```http
 * POST /api/v1/bot/create
 * Content-Type: application/json
 *
 * {
 *   "name": "My Production Bot",
 *   "alias": "my-production-bot",
 *   "backstory": "You are a helpful assistant..."
 * }
 * ```
 *
 * To update an existing resource's alias:
 *
 * ```http
 * POST /api/v1/bot/{botId}/update
 * Content-Type: application/json
 *
 * {
 *   "alias": "new-alias-name"
 * }
 * ```
 *
 * **Note:** To remove an alias, set it to an empty string or null.
 *
 * ## Best Practices
 *
 * - Use descriptive, meaningful names that indicate the resource's purpose
 * - Include environment indicators for different deployments (e.g., `prod-bot`, `staging-bot`)
 * - Keep aliases short but recognizable
 * - Establish naming conventions within your organization for consistency
 */

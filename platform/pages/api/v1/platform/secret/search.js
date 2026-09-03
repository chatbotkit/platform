// @ts-check
import secretsData from '@/data/secrets/visible'

import { assert } from '@/lib/debug'
import { getExternalHostURL } from '@/lib/host'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { toKebabCase } from '@/lib/string'
import { matchSearchText } from '@/lib/text.search'

export const bodySchema = schema.object({
  search: schema.string(),
  take: schema.number().integer().min(1).max(100).default(10),
})

/**
 * @swagger
 *
 * /platform/secret/search:
 *   post:
 *     operationId: searchPlatformSecrets
 *     summary: Search platform secrets
 *     tags:
 *       - Platform
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               search:
 *                 description: The search query to find relevant secrets
 *                 type: string
 *               take:
 *                 description: The maximum number of results to return (1-100, default 10)
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 10
 *             required:
 *               - search
 *     responses:
 *       200:
 *         description: The search was successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/InstanceListProps'
 *                       - type: object
 *                         properties:
 *                           template:
 *                             type: string
 *                             description: The original template identifier for the secret
 *                           type:
 *                             $ref: '#/components/schemas/SecretType'
 *                           kind:
 *                             $ref: '#/components/schemas/SecretKind'
 *                           config:
 *                             type: object
 *                             additionalProperties: true
 *                           icon:
 *                             type: string
 *                           tags:
 *                             type: array
 *                             items:
 *                               type: string
 *                           setup:
 *                             type: string
 *                           commentary:
 *                             type: string
 *                           score:
 *                             description: The text relevance score of the search result
 *                             type: number
 *                           excerpt:
 *                             description: An excerpt from the most relevant part of the secret
 *                             type: string
 *                           link:
 *                             description: The URL to the official secret page
 *                             type: string
 *                         required:
 *                           - type
 *                           - score
 *                           - excerpt
 *               required:
 *                 - items
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(
    withSchema(bodySchema, async function (_req, _session, body) {
      const { search, take = 10 } = body

      if (!search || search.trim().length === 0) {
        return ok({ items: [] })
      }

      const results = []

      for (const [template, secret] of Object.entries(secretsData)) {
        const match = matchSearchText(search, [
          { value: secret.name, weight: 12, excerpt: true },
          { value: secret.tags, weight: 8 },
          { value: secret.description, weight: 6, excerpt: true },
          { value: secret.type, weight: 4 },
          { value: secret.kind, weight: 4 },
          { value: secret.setup, weight: 3, excerpt: true },
          { value: secret.commentary, weight: 2, excerpt: true },
          { value: secret.config, weight: 1 },
        ])

        if (!match) {
          continue
        }

        results.push({
          template,
          score: match.score,
          snippet: match.excerpt || secret.description || '',
        })
      }

      results.sort((a, b) => b.score - a.score)

      const items = results
        .slice(0, take)
        .map((result) => {
          const secret = secretsData[result.template]

          if (!secret) {
            return null
          }

          assert(
            // @ts-ignore
            !secret?.config?.clientId,
            'secret config should not expose clientId'
          )
          assert(
            // @ts-ignore
            !secret?.config?.clientSecret,
            'secret config should not expose clientSecret'
          )
          assert(
            // @ts-ignore
            !secret?.config?.password,
            'secret config should not expose password'
          )
          assert(
            // @ts-ignore
            !secret?.config?.pass,
            'secret config should not expose password'
          )

          return {
            id: toKebabCase(result.template),

            template: result.template,

            name: secret.name,
            description: secret.description,

            type: secret.type,
            kind: secret.kind,
            config: secret.config,

            icon: secret.icon,
            tags: secret.tags,
            setup: secret.setup,
            commentary: secret.commentary,

            score: result.score,
            excerpt: result.snippet || '',
            link: getExternalHostURL(`/secrets/${result.template}`),

            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        })
        .filter((item) => item !== null)

      return ok({ items })
    })
  )
)

/**
 * @manual Platform Secrets
 * @index 14
 *
 * ## Searching Secrets
 *
 * Text search helps you find relevant standard platform secret templates
 * quickly. The endpoint compares your query against the local secret catalogue
 * and returns ranked results. Use this to discover which secret template to
 * configure before connecting an external service to an ability.
 *
 * ```http
 * POST /api/v1/platform/secret/search
 * Content-Type: application/json
 *
 * {
 *   "search": "oauth token for google calendar",
 *   "take": 10
 * }
 * ```
 *
 * The `search` field accepts natural language queries. Describe the service
 * or authentication method you need - for example "Slack bot token",
 * "Jira API key", or "GitHub personal access token". The optional `take`
 * parameter limits the number of results returned (1-100, default 10).
 *
 * ## Secret Search Response Fields
 *
 * Each item in the `items` array contains the following fields:
 *
 * - **id**: Kebab-case slug derived from the template key (e.g.
 *   `google-calendar`). Use this as a stable reference.
 * - **template**: The original catalogue key (e.g. `google/calendar`).
 *   Reference this when creating a secret in your account.
 * - **name**: Human-readable name of the secret template.
 * - **description**: Short explanation of what this secret is used for.
 * - **type**: The authentication type. One of `plain` (API key in
 *   query/header), `bearer` (token in Authorization header), `oauth`
 *   (OAuth2 flow), or `template` (platform-managed OAuth).
 * - **kind**: The secret scope. `shared` means it applies across all
 *   interactions; `personal` means it is user-specific.
 * - **config**: Partial OAuth configuration (when applicable) such as
 *   authorization and token URLs and required scopes. Sensitive fields
 *   like `clientId`, `clientSecret`, and `password` are always stripped
 *   from search results.
 * - **icon**: URL or icon reference for displaying in UI.
 * - **tags**: Array of string tags for categorisation.
 * - **setup**: User-facing instructions explaining how to obtain the
 *   secret value (e.g. steps to create an API key in the provider's
 *   dashboard).
 * - **commentary**: Internal notes about quirks or caveats of this
 *   secret template.
 * - **score**: Weighted text relevance score between 0 and 1. Higher values
 *   indicate a closer match.
 * - **excerpt**: Text snippet from the best matching catalogue field.
 * - **link**: URL to the full secret template page on the ChatBotKit
 *   website.
 *
 * ```javascript
 * {
 *   "items": [
 *     {
 *       "id": "google-calendar",
 *       "template": "google/calendar",
 *       "name": "Google Calendar",
 *       "description": "Connect to Google Calendar to access your events.",
 *       "type": "oauth",
 *       "kind": "personal",
 *       "config": {
 *         "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth",
 *         "tokenUrl": "https://oauth2.googleapis.com/token",
 *         "scope": "https://www.googleapis.com/auth/calendar"
 *       },
 *       "tags": ["google", "calendar", "oauth"],
 *       "score": 0.91,
 *       "excerpt": "OAuth2 token granting access to Google Calendar events...",
 *       "link": "https://chatbotkit.com/secrets/google-calendar"
 *     }
 *   ]
 * }
 * ```
 *
 * **Security note:** Sensitive configuration fields (`clientId`,
 * `clientSecret`, `password`, `pass`) are always omitted from search
 * results regardless of the secret's configuration.
 */

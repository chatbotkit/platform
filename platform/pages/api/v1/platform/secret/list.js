// @ts-check
import secretsData from '@/data/secrets/visible'

import { assert } from '@/lib/debug'
import { withStreamCursor } from '@/lib/stream'
import { withGet } from '@/lib/method'
import { withSession } from '@/lib/session.handler'
import { toKebabCase } from '@/lib/string'

/**
 * @swagger
 *
 * /platform/secret/list:
 *   get:
 *     operationId: listPlatformSecrets
 *     summary: Retrieve a list of platform secrets
 *     tags:
 *       - Platform
 *     parameters:
 *       - in: query
 *         name: cursor
 *         schema:
 *           description: The cursor to use for pagination
 *           type: string
 *       - in: query
 *         name: order
 *         schema:
 *           description: The order of the paginated items
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: desc
 *       - in: query
 *         name: take
 *         schema:
 *           description: The number of items to retrieve
 *           type: integer
 *       - in: query
 *         name: meta
 *         schema:
 *           description: Key-value pairs to filter the items by metadata
 *           type: object
 *           additionalProperties:
 *             type: string
 *         style: deepObject
 *         explode: true
 *     responses:
 *       200:
 *         description: The list of secrets was retrieved successfully
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
 *                             # @todo make it better type
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
 *                         required:
 *                           - type
 *                 cursor:
 *                   description: Cursor for fetching the next page
 *                   type: string
 *               required:
 *                 - items
 *                 - cursor
 *           application/jsonl:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     type:
 *                       description: The type of event
 *                       type: string
 *                       enum:
 *                         - item
 *                     data:
 *                       $ref: '#/paths/~1platform~1secret~1list/get/responses/200/content/application~1json/schema/properties/items/items'
 *                   required:
 *                     - type
 *                     - data
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(
    withStreamCursor(async function (cursor) {
      if (cursor) {
        return {
          items: [],
        }
      }

      return {
        items: Object.entries(secretsData).map(
          ([
            template,
            {
              name,
              description,

              type,
              kind,

              config,

              icon,
              tags,
              setup,
              commentary,
            },
          ]) => {
            assert(
              // @ts-ignore
              !config?.clientId,
              'secret config should not expose clientId'
            )
            assert(
              // @ts-ignore
              !config?.clientSecret,
              'secret config should not expose clientSecret'
            )
            assert(
              // @ts-ignore
              !config?.password,
              'secret config should not expose password'
            )
            assert(
              // @ts-ignore
              !config?.pass,
              'secret config should not expose password'
            )

            return {
              id: toKebabCase(template),

              template,

              name,
              description,

              type,
              kind,

              config,

              icon,

              tags,

              setup,
              commentary,

              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
          }
        ),
      }
    })
  )
)

/**
 * @manual Platform Secrets
 * @description Secrets are secure credential types that the platform supports for authenticating with external services and APIs, enabling secure integration with third-party systems.
 * @category Platform
 * @tags secrets, credentials, authentication, security
 * @index 13
 *
 * Many abilities and integrations require authentication credentials to access
 * external services such as Google Calendar, Notion, Slack, or custom APIs.
 * The platform provides a secure secret management system that stores and
 * handles these credentials safely, preventing exposure in logs or client-side
 * code.
 *
 * ## Understanding Secret Types
 *
 * To discover which types of credentials and authentication methods are
 * supported by the platform:
 *
 * ```http
 * GET /api/v1/platform/secret/list
 * ```
 *
 * Each secret type in the response describes a specific authentication method:
 *
 * - **id**: URL-safe kebab-case slug derived from the template key (e.g., `google-oauth`)
 * - **template**: The original catalogue identifier for the secret (e.g., `google/oauth`)
 * - **name**: Human-readable name of the credential type
 * - **description**: Explanation of what service or purpose this secret type serves
 * - **type**: The authentication mechanism (API key, OAuth token, etc.)
 *
 * ## Secret Types and Use Cases
 *
 * Different secret types correspond to different authentication mechanisms:
 *
 * - **API Keys**: Simple authentication tokens for services that use key-based auth
 * - **OAuth Tokens**: Authorization credentials obtained through OAuth flows
 * - **Service Credentials**: Specialized authentication for enterprise services
 * - **Custom Secrets**: User-defined credential types for proprietary integrations
 *
 * ```javascript
 * {
 *   "id": "google-oauth",
 *   "template": "google/oauth",
 *   "name": "Google OAuth",
 *   "description": "OAuth credentials for Google services",
 *   "type": "oauth2"
 * }
 * ```
 *
 * ## Working with Secrets
 *
 * The secret list endpoint helps you understand which credential types are
 * available when configuring abilities or integrations. When setting up an
 * ability that requires authentication:
 *
 * 1. Check the ability's documentation to determine which secret type is required
 * 2. Verify that the necessary secret type is supported by checking this list
 * 3. Create a secret of the appropriate type through the platform's secret management endpoints
 * 4. Reference the secret by ID when configuring the ability
 *
 * ## Security Best Practices
 *
 * Secrets are stored securely and encrypted at rest. The platform ensures that:
 *
 * - Secret values are never exposed in API responses
 * - Secrets are only accessible to authorized resources within your account
 * - Secret access is logged for audit purposes
 * - Secrets can be rotated without changing ability configurations
 *
 * **Important:** This endpoint only lists the types of secrets that are
 * supported by the platform. It does not return actual secret values or the
 * secrets you have created in your account. To manage your actual secrets,
 * use the dedicated secret management endpoints.
 *
 * **Security Warning:** Never commit secrets to source control, expose them in
 * client-side code, or share them through insecure channels. Always use the
 * platform's secret management system to handle credentials securely.
 */

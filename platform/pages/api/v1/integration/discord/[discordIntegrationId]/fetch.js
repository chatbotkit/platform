// @ts-check
import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { makeJsonSafe } from '@/lib/struct'

/**
 * @swagger
 *
 * /integration/discord/{discordIntegrationId}/fetch:
 *   get:
 *     operationId: fetchDiscordIntegration
 *     summary: Fetch a discordIntegration
 *     tags:
 *       - Discord Integration
 *     parameters:
 *       - in: path
 *         name: discordIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Discord integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The Discord integration was retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/InstanceRefProperties'
 *                 - $ref: '#/components/schemas/InstanceListProps'
 *                 - $ref: '#/components/schemas/BotRef'
 *                 - $ref: '#/components/schemas/BlueprintProps'
 *                 - type: object
 *                   properties:
 *                     appId:
 *                       description: The Discord application ID
 *                       type: string
 *                     # botToken:
 *                     #   description: The Discord bot token
 *                     #   type: string
 *                     # publicKey:
 *                     #   description: The Discord public key
 *                     #   type: string
 *                     handle:
 *                       description: The Discord command handle
 *                       type: string
 *                     # ephemeral:
 *                     #   description: Indicate if the conversation is only visible to the user who invoked it.
 *                     #   type: boolean
 *                     contactCollection:
 *                       description: Weather to collect contacts
 *                       type: boolean
 *                     sessionDuration:
 *                       description: The chat session duration
 *                       type: number
 *                     # attachments:
 *                     #   description: Weather the bot supports attachments
 *                     #   type: boolean
 *                     allowFrom:
 *                       description: Restrict which Discord users can interact with this integration. Accepts Discord user IDs (17-18 digit snowflakes) or @username, one per line. Use * to allow all senders. Leave empty to deny all.
 *                       type: string
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const discordIntegration =
      await prisma.discordIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'discordIntegrationId'),
        {
          select: {
            // identifiers

            id: true,

            alias: true,

            // basic information

            name: true,
            description: true,

            // resource linking

            userId: true,

            blueprintId: true,

            botId: true,

            // resource specific: options

            appId: true,
            // botToken: true, // disabled for security reasons
            // publicKey: true, // disabled for security reasons

            handle: true,

            // ephemeral: true, // disabled because the name is confusing

            contactCollection: true,

            sessionDuration: true,

            // attachments: true, // disabled because not supported

            allowFrom: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!discordIntegration) {
      return notFound()
    }

    if (discordIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (discordIntegration).userId)

    return ok(makeJsonSafe(discordIntegration))
  })
)

/**
 * @manual Discord Integration
 * @index 40
 *
 * ## Fetching a Discord Integration
 *
 * Fetching a specific Discord integration retrieves detailed configuration
 * information for a single integration, including all settings and associations.
 * This endpoint is essential for retrieving the complete integration state when
 * displaying configuration details, performing updates, or troubleshooting issues
 * with a specific Discord bot deployment.
 *
 * Unlike the list endpoint, fetching a single integration provides access to
 * the complete configuration including sensitive fields (though credentials like
 * Bot Token and Public Key remain protected). The fetch operation requires the
 * unique integration identifier and returns comprehensive details about the
 * integration's current state and configuration.
 *
 * ```http
 * GET /api/v1/integration/discord/{discordIntegrationId}/fetch
 * ```
 *
 * The response includes all publicly accessible configuration parameters: basic
 * identification including the unique ID, human-readable name and description for
 * reference, blueprint and bot associations showing which AI bot powers this
 * integration, Discord-specific configuration including Application ID and slash
 * command handle, behavior settings like ephemeral mode and session duration,
 * custom metadata for extended properties, and creation and update timestamps for
 * tracking changes.
 *
 * ## Using Integration Identifiers
 *
 * The `discordIntegrationId` parameter accepts multiple identifier formats for
 * flexible access. You can use the standard UUID format (e.g.,
 * `di_abc123def456ghi789`), which is the most common approach. Alternatively,
 * you can use custom identifiers if you've configured metadata-based lookup
 * patterns for your integrations.
 *
 * This flexibility allows you to retrieve integrations using identifiers from
 * external systems or custom naming schemes, making it easier to integrate with
 * existing infrastructure or management tools. The system automatically resolves
 * the provided identifier to the correct integration while enforcing access
 * control to ensure users can only fetch their own integrations.
 *
 * **Security Note:** The fetch endpoint excludes sensitive credential fields
 * (Bot Token and Public Key) from responses for security reasons. These credentials
 * are write-only after initial creation and can only be updated through the update
 * endpoint. If you need to verify or rotate these credentials, you must provide
 * new values through an update operation rather than retrieving existing values.
 *
 * This security model prevents credential leakage through API responses while still
 * allowing full integration management. The Application ID is included in responses
 * as it's considered a public identifier used in Discord's OAuth and interaction
 * flows, but authentication tokens remain protected.
 */

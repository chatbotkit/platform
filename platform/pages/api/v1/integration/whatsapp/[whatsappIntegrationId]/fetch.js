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
 * /integration/whatsapp/{whatsappIntegrationId}/fetch:
 *   get:
 *     operationId: fetchWhatsAppIntegration
 *     summary: Fetch a whatsappIntegration
 *     tags:
 *       - WhatsApp Integration
 *     parameters:
 *       - in: path
 *         name: whatsappIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the WhatsApp integration to retrieve
 *           type: string
 *     responses:
 *       200:
 *         description: The WhatsApp integration was retrieved successfully
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
 *                     verifyToken:
 *                       description: The WhatsApp integration verify token
 *                       type: string
 *                     phoneNumberId:
 *                       description: The WhatsApp integration phone number ID
 *                       type: string
 *                       nullable: true
 *                     accessToken:
 *                       description: The WhatsApp integration access token (returned as '********' if configured, null otherwise)
 *                       type: string
 *                       nullable: true
 *                     appSecret:
 *                       description: The Meta app secret (returned as '********' if configured, null otherwise)
 *                       type: string
 *                       nullable: true
 *                     contactCollection:
 *                       description: Weather to collect contacts
 *                       type: boolean
 *                     sessionDuration:
 *                       description: The session duration (in milliseconds)
 *                       type: number
 *                       nullable: true
 *                     attachments:
 *                       description: Weather the bot supports attachments
 *                       type: boolean
 *                     allowFrom:
 *                       description: Newline-or-comma-separated list of allowed senders
 *                       type: string
 *                       nullable: true
 *                   required:
 *                     - verifyToken
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withGet(
  withSession(async function (req, session) {
    const whatsappIntegration =
      await prisma.whatsappIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'whatsappIntegrationId'),
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

            verifyToken: true,

            phoneNumberId: true,

            accessToken: true,
            appSecret: true,

            contactCollection: true,

            sessionDuration: true,

            attachments: true,

            allowFrom: true,

            // meta and others

            meta: true,

            createdAt: true,
            updatedAt: true,
          },
        }
      )

    if (!whatsappIntegration) {
      return notFound()
    }

    if (whatsappIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    delete (/** @type {any} */ (whatsappIntegration).userId)

    if (whatsappIntegration.accessToken) {
      /** @type {any} */ whatsappIntegration.accessToken = '********'
    }

    if (whatsappIntegration.appSecret) {
      /** @type {any} */ whatsappIntegration.appSecret = '********'
    }

    return ok(makeJsonSafe(whatsappIntegration))
  })
)

/**
 * @manual WhatsApp Integration
 *
 * ## Fetching Integration Details
 *
 * Retrieve complete configuration details for a specific WhatsApp integration,
 * including all settings, linked resources, and operational parameters. This
 * endpoint is essential for displaying integration configuration in management
 * interfaces and verifying setup status.
 *
 * Use the integration ID to fetch detailed information about a specific
 * WhatsApp integration. The response includes all configuration options and
 * their current values, enabling you to display complete integration settings
 * or use the data to populate update forms:
 *
 * ```http
 * GET /api/v1/integration/whatsapp/{whatsappIntegrationId}/fetch
 * Content-Type: application/json
 * ```
 *
 * ### Retrieved Information
 *
 * The fetch endpoint returns comprehensive integration details:
 *
 * **Identity Information**:
 * - Integration ID (unique identifier for all API operations)
 * - Name and description for display and organizational purposes
 * - Creation and last update timestamps
 *
 * **WhatsApp Configuration**:
 * - Verify Token (for Meta webhook verification)
 * - Phone Number ID (WhatsApp Business phone number identifier)
 * - Contact Collection flag (whether to collect user contact information)
 * - Attachments flag (support for files and multimedia)
 * - Session Duration (conversation session persistence time in milliseconds)
 *
 * **Resource Relationships**:
 * - Bot ID (linked conversational AI bot)
 * - Blueprint ID (associated configuration blueprint)
 *
 * **Metadata**:
 * - Custom metadata object for application-specific data
 *
 * ### Security Considerations
 *
 * For security reasons, the `accessToken` field is returned as a sentinel value
 * instead of the actual credential:
 *
 * - Returns `"********"` if an access token is configured
 * - Returns `null` if no access token has been set
 *
 * This allows you to verify that credentials are configured without exposing
 * the actual token values. Access tokens provide full control over WhatsApp
 * Business API operations and should be treated as sensitive credentials.
 * When updating an integration, you can send back the sentinel value
 * `"********"` and the existing token will be preserved unchanged. Only send
 * a new actual token value if you want to update it.
 *
 * **User Authorization**: The fetch operation verifies that the requesting
 * user owns the integration. Attempting to fetch another user's integration
 * will result in a 404 Not Found response, preventing information disclosure.
 *
 * ### Common Use Cases
 *
 * **Configuration Display**: Populate integration settings pages in
 * administrative interfaces, showing current configuration values and
 * status indicators.
 *
 * **Setup Verification**: Verify that all required fields (phone number ID,
 * access token) have been configured before enabling the integration.
 *
 * **Update Forms**: Pre-populate update forms with current configuration
 * values, allowing users to modify specific settings while preserving others.
 *
 * **Status Monitoring**: Check integration configuration as part of health
 * checks or troubleshooting workflows.
 *
 * **Integration Cloning**: Retrieve configuration from an existing integration
 * to use as a template for creating similar integrations.
 *
 * **Note**: Always store sensitive credentials like access tokens securely
 * on your backend. Never expose them in client-side code or logs.
 */

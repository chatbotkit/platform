// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { captureError } from '@/lib/error'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import {
  notAuthorized,
  notFound,
  ok,
  respondFromError,
  throwConflict,
} from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @param {import('@/prisma/types').WhatsappIntegration} whatsappIntegration
 * @returns {Promise<void>}
 */
export async function doSetup(whatsappIntegration) {
  debug(`do setup`, { whatsappIntegration })

  if (!whatsappIntegration.phoneNumberId) {
    return throwConflict('No phone number ID found')
  }

  if (!whatsappIntegration.accessToken) {
    return throwConflict('No access token found')
  }
}

/**
 * @swagger
 *
 * /integration/whatsapp/{whatsappIntegrationId}/setup:
 *   post:
 *     operationId: setupWhatsAppIntegration
 *     summary: Setup a WhatsApp integration
 *     tags:
 *       - WhatsApp Integration
 *     parameters:
 *       - in: path
 *         name: whatsappIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the WhatsApp integration
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: {}
 *     responses:
 *       200:
 *         description: The WhatsApp integration was successfully setup
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the WhatsApp Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const whatsappIntegration =
      await prisma.whatsappIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'whatsappIntegrationId')
      )

    if (!whatsappIntegration) {
      return notFound()
    }

    if (whatsappIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    try {
      await doSetup(whatsappIntegration)
    } catch (e) {
      await captureError(e)

      return respondFromError(e)
    }

    return ok({ id: whatsappIntegration.id })
  })
)

/**
 * @manual WhatsApp Integration
 *
 * ## Setup and Configuration
 *
 * The setup endpoint performs initialization and validation tasks for a
 * WhatsApp integration, ensuring all required configurations are in place
 * and properly connected with the Meta WhatsApp Business API. This endpoint
 * is typically called after creating an integration and configuring the
 * necessary credentials and settings.
 *
 * Setup operations verify that the integration is properly configured and
 * ready to receive and send messages through WhatsApp. While the current
 * implementation is lightweight, this endpoint provides a foundation for
 * future setup automation and validation logic:
 *
 * ```http
 * POST /api/v1/integration/whatsapp/{whatsappIntegrationId}/setup
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * ### Setup Prerequisites
 *
 * Before calling the setup endpoint, ensure you have completed these
 * configuration steps:
 *
 * **Meta Business Account**: You must have an active Meta Business account
 * with appropriate permissions. Depending on your account status, you may
 * need to configure payment details and verify your business information.
 *
 * **WhatsApp Business Application**: Create a WhatsApp Business application
 * through the Meta Developer Portal. This application provides the API
 * access needed for programmatic messaging.
 *
 * **Phone Number**: Obtain a WhatsApp Business phone number, either a
 * production number or a test number. Test numbers have limitations and
 * can only communicate with pre-verified recipient numbers.
 *
 * **Access Token**: Generate a permanent access token with the required
 * permissions (`whatsapp_business_messaging` and `whatsapp_business_management`).
 * This token must be created through a System User with Admin role for
 * production use.
 *
 * **App Secret** (optional, recommended): Copy the app secret from Meta for
 * Developers into the integration to enable `X-Hub-Signature-256` validation of
 * every webhook notification. When left unset, notifications are accepted
 * without signature validation, so this can be adopted without downtime.
 *
 * **Webhook Configuration**: Set up webhooks in the Meta Developer Portal
 * using the callback URL and verify token provided by your ChatBotKit
 * integration. The webhook must be configured to receive the "messages"
 * field for proper operation.
 *
 * ### Configuration Verification
 *
 * The setup process validates that critical configuration elements are
 * present and correctly formatted. While specific validation logic may
 * evolve, the endpoint ensures your integration meets minimum requirements
 * for WhatsApp messaging operations.
 *
 * ### Common Setup Issues
 *
 * **Missing Phone Number ID**: Ensure you've copied the Phone Number ID
 * from the Meta API Setup page and configured it in your integration. This
 * identifier is essential for routing messages to the correct WhatsApp
 * Business number.
 *
 * **Invalid Access Token**: Verify that your access token has the correct
 * permissions and hasn't expired. System User tokens should be configured
 * for long-term validity to avoid service interruptions.
 *
 * **Webhook Verification Failure**: If webhooks aren't receiving messages,
 * verify that you've correctly copied the callback URL and verify token
 * to the Meta Developer Portal. The verify token is case-sensitive and
 * must match exactly.
 *
 * **Test Number Limitations**: Test phone numbers can only send messages
 * to numbers that have been pre-verified in the Meta Developer Portal.
 * Add recipient numbers to the verified list before testing.
 *
 * ### Setup Workflow
 *
 * 1. **Create Integration**: Use the create endpoint to establish a new
 * WhatsApp integration and receive your verify token
 *
 * 2. **Configure Meta Webhooks**: Set up webhook configuration in the
 * Meta Developer Portal using the provided callback URL and verify token
 *
 * 3. **Generate Access Token**: Create a permanent access token through
 * a System User in your Meta Business account
 *
 * 4. **Update Integration**: Add the Phone Number ID and access token (and
 * optionally the app secret) to your integration using the update endpoint
 *
 * 5. **Run Setup**: Call this setup endpoint to validate the configuration
 *
 * 6. **Test Messaging**: Send a test message to your WhatsApp Business
 * number to verify end-to-end functionality
 *
 * ### Integration Health Monitoring
 *
 * After successful setup, monitor your integration through:
 *
 * - **Event Logs**: Review integration event logs for webhook delivery
 * confirmations and message processing events
 *
 * - **Conversation History**: Verify that conversations are being created
 * and messages are being processed correctly
 *
 * - **Error Tracking**: Watch for authentication errors, rate limiting,
 * or delivery failures that might indicate configuration issues
 *
 * For detailed step-by-step setup instructions with screenshots and
 * troubleshooting guidance, refer to the [WhatsApp Integration Guide](/docs/whatsapp)
 * in the main documentation.
 */

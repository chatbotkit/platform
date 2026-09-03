/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Meta Graph) */
// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { captureError } from '@/lib/error'
import fetch from '@/lib/fetch'
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

// @note Meta Graph API version - should match the version in queue.js
const META_GRAPH_API_VERSION = 'v21.0'

/**
 * The function is responsible for setting up ice breakers to help users start
 * conversations with the bot. Ice breakers are suggested questions that appear
 * when a user first opens a chat with the Instagram account.
 *
 * @param {import('@/prisma/types').InstagramIntegration} instagramIntegration
 * @returns {Promise<void>}
 */
export async function doSetup(instagramIntegration) {
  debug(`do setup`, { instagramIntegration })

  if (!instagramIntegration.accessToken) {
    return throwConflict('No access token found')
  }

  // setup ice breakers for Instagram
  // @note Instagram uses ice_breakers instead of persistent_menu like Messenger
  {
    const response = await fetch(
      `https://graph.facebook.com/${META_GRAPH_API_VERSION}/me/messenger_profile?access_token=${instagramIntegration.accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: 'instagram',
          ice_breakers: [
            {
              question: 'Talk to a human',
              payload: 'HUMAN_AGENT',
            },
            {
              question: 'What can you help me with?',
              payload: 'GET_STARTED',
            },
          ],
        }),
      }
    )

    if (!response.ok) {
      const data = await response.json()

      return throwConflict(
        data.error?.message || 'Failed to setup ice breakers'
      )
    }
  }
}

/**
 * @swagger
 *
 * /integration/instagram/{instagramIntegrationId}/setup:
 *   post:
 *     operationId: setupInstagramIntegration
 *     summary: Setup an Instagram integration
 *     tags:
 *       - Instagram Integration
 *     parameters:
 *       - in: path
 *         name: instagramIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Instagram integration
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
 *         description: The Instagram integration was successfully setup
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Instagram Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const instagramIntegration =
      await prisma.instagramIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'instagramIntegrationId')
      )

    if (!instagramIntegration) {
      return notFound()
    }

    if (instagramIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    try {
      await doSetup(instagramIntegration)
    } catch (e) {
      await captureError(e)

      return respondFromError(e)
    }

    return ok({ id: instagramIntegration.id })
  })
)

/**
 * @manual Instagram Integration
 *
 * ## Setup and Configuration
 *
 * The setup endpoint performs initialization and validation tasks for an
 * Instagram integration, ensuring all required configurations are in place
 * and properly connected with the Meta Instagram Messaging API. This endpoint
 * is typically called after creating an integration and configuring the
 * necessary credentials and settings.
 *
 * Setup operations verify that the integration is properly configured and
 * ready to receive and send messages through Instagram. While the current
 * implementation is lightweight, this endpoint provides a foundation for
 * future setup automation and validation logic:
 *
 * ```http
 * POST /api/v1/integration/instagram/{instagramIntegrationId}/setup
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
 * **Instagram Professional Account**: You need an Instagram Professional
 * (Business or Creator) account connected to a Facebook Page.
 *
 * **Facebook App**: Create a Facebook App in the Meta Developer Portal
 * with the Instagram Messaging product enabled.
 *
 * **Access Token**: Generate an access token with the required permissions
 * (`instagram_manage_messages`). This token must be created through a
 * System User with Admin role for production use.
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
 * for Instagram messaging operations.
 *
 * ### Common Setup Issues
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
 * **Account Connection Issues**: Ensure your Instagram Professional account
 * is properly connected to your Facebook Page and that the Facebook App
 * has the necessary permissions.
 *
 * ### Setup Workflow
 *
 * 1. **Create Integration**: Use the create endpoint to establish a new
 * Instagram integration and receive your verify token
 *
 * 2. **Configure Meta Webhooks**: Set up webhook configuration in the
 * Meta Developer Portal using the provided callback URL and verify token
 *
 * 3. **Generate Access Token**: Create an access token through a System
 * User in your Meta Business account
 *
 * 4. **Update Integration**: Add the access token to your integration
 * using the update endpoint
 *
 * 5. **Run Setup**: Call this setup endpoint to validate the configuration
 *
 * 6. **Test Messaging**: Send a test message to your Instagram account
 * to verify end-to-end functionality
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
 * troubleshooting guidance, refer to the [Instagram Integration Guide](/docs/instagram)
 * in the main documentation.
 */

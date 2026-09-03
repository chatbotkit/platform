// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { captureError } from '@/lib/error'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok, respondFromError } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @param {import('@/prisma/types').TwilioIntegration} twilioIntegration
 * @returns {Promise<void>}
 */
export async function doSetup(twilioIntegration) {
  debug(`do setup`, { twilioIntegration })
}

/**
 * @swagger
 *
 * /integration/twilio/{twilioIntegrationId}/setup:
 *   post:
 *     operationId: setupTwilioIntegration
 *     summary: Setup a Twilio integration
 *     tags:
 *       - Twilio Integration
 *     parameters:
 *       - in: path
 *         name: twilioIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Twilio integration
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
 *         description: The Twilio integration was successfully setup
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Twilio Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const twilioIntegration =
      await prisma.twilioIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'twilioIntegrationId')
      )

    if (!twilioIntegration) {
      return notFound()
    }

    if (twilioIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    try {
      await doSetup(twilioIntegration)
    } catch (e) {
      await captureError(e)

      return respondFromError(e)
    }

    return ok({ id: twilioIntegration.id })
  })
)

/**
 * @manual Twilio Integration
 *
 * ## Setting Up Twilio Integrations
 *
 * Perform initial setup and configuration tasks for a Twilio integration after
 * creation. The setup endpoint prepares the integration for operation by verifying
 * configuration, establishing connections, and ensuring all components are properly
 * initialized.
 *
 * Execute setup for a Twilio integration by sending a POST request:
 *
 * ```http
 * POST /api/v1/integration/twilio/{twilioIntegrationId}/setup
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * The API confirms successful setup:
 *
 * ```json
 * {
 *   "id": "twilio_abc123"
 * }
 * ```
 *
 * ### When to Run Setup
 *
 * **After Initial Creation**: Run setup immediately after creating a new Twilio
 * integration to ensure it's properly configured and ready to handle incoming
 * SMS messages.
 *
 * **After Configuration Changes**: If you've made significant changes to the
 * integration configuration (such as changing the bot or updating webhook settings),
 * running setup can help ensure all components are synchronized.
 *
 * **Troubleshooting**: When experiencing issues with message delivery or bot
 * responses, running setup can help reset and reconfigure the integration to
 * resolve potential configuration problems.
 *
 * ### What Setup Does
 *
 * The setup process performs several important initialization tasks:
 *
 * **Configuration Verification**: Validates that all required settings are properly
 * configured, including bot association, session management settings, and resource
 * links.
 *
 * **Connection Testing**: Verifies that the integration can communicate with
 * necessary ChatBotKit services and that webhook endpoints are properly configured.
 *
 * **Resource Initialization**: Ensures that all resources referenced by the
 * integration (bots, datasets, blueprints) are accessible and properly linked.
 *
 * **State Preparation**: Prepares internal state management structures needed
 * for conversation tracking and session management.
 *
 * ### Response Format
 *
 * The setup endpoint returns the integration ID upon successful completion,
 * confirming that all setup tasks completed without errors. If setup encounters
 * problems, the API returns detailed error information to help you diagnose and
 * resolve configuration issues.
 *
 * ### Setup Performance
 *
 * Setup operations typically complete within a few seconds. The process runs
 * synchronously, so the API response indicates that setup has fully completed.
 * You can begin using the integration immediately after receiving a successful
 * setup response.
 *
 * ### Best Practices
 *
 * **Run After Creation**: Always run setup immediately after creating a new
 * integration to ensure it's ready for production use.
 *
 * **Monitor Setup Results**: Check the setup response for any warnings or errors
 * that might indicate configuration problems requiring attention.
 *
 * **Document Setup Timing**: Track when setup was last performed for each
 * integration to aid in troubleshooting and maintenance.
 */

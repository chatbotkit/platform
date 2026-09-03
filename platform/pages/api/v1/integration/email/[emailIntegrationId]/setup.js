// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { captureError } from '@/lib/error'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok, respondFromError } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @param {import('@/prisma/types').EmailIntegration} emailIntegration
 * @returns {Promise<void>}
 */
export async function doSetup(emailIntegration) {
  debug(`do setup`, { emailIntegration })
}

/**
 * @swagger
 *
 * /integration/email/{emailIntegrationId}/setup:
 *   post:
 *     operationId: setupEmailIntegration
 *     summary: Setup a Email integration
 *     tags:
 *       - Email Integration
 *     parameters:
 *       - in: path
 *         name: emailIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Email integration
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
 *         description: The Email integration was successfully setup
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Email Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const emailIntegration =
      await prisma.emailIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'emailIntegrationId')
      )

    if (!emailIntegration) {
      return notFound()
    }

    if (emailIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    try {
      await doSetup(emailIntegration)
    } catch (e) {
      await captureError(e)

      return respondFromError(e)
    }

    return ok({ id: emailIntegration.id })
  })
)

/**
 * @manual Email Integration
 *
 * ## Setting Up an Email Integration
 *
 * The setup endpoint allows you to initialize or reconfigure an Email Integration
 * after creation. This operation prepares the integration for active use by
 * validating configurations, establishing necessary connections, and ensuring
 * all required resources are properly linked and accessible.
 *
 * While Email Integrations are immediately functional after creation, the setup
 * operation is useful when you need to refresh configurations, verify connectivity,
 * or reinitialize the integration after making changes to linked resources such
 * as bots or blueprints:
 *
 * ```http
 * POST /api/v1/integration/email/{emailIntegrationId}/setup
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * ### When to Use Setup
 *
 * The setup operation is particularly useful in these scenarios:
 *
 * **After Configuration Changes**: If you've updated the associated bot's
 * instructions, modified the blueprint, or changed any resource links, running
 * setup ensures the integration reflects these changes.
 *
 * **Troubleshooting**: When experiencing issues with email processing or bot
 * responses, running setup can help identify and resolve configuration problems
 * by revalidating all connections.
 *
 * **Migration or Restoration**: After importing integrations from backups or
 * moving configurations between environments, setup ensures everything is properly
 * initialized in the new context.
 *
 * ### Setup Process
 *
 * During setup, the system performs several validation and initialization steps:
 * - Verifies the linked bot exists and is accessible
 * - Validates blueprint resources (if configured)
 * - Confirms the inbox address is properly routed
 * - Ensures session management is correctly configured
 * - Validates attachment handling capabilities
 *
 * The setup operation is idempotent, meaning you can safely run it multiple times
 * without causing issues. Each execution performs the same validation and
 * initialization steps regardless of the integration's current state.
 *
 * ### Error Handling
 *
 * If setup encounters configuration issues, it will return detailed error
 * information indicating what needs to be corrected. Common issues include
 * missing or inaccessible bots, invalid blueprint references, or permission
 * problems. Address these issues and run setup again to complete the process.
 *
 * **Note**: The setup operation does not modify your integration's configuration
 * settings. It only validates and initializes the integration based on its current
 * configuration. Use the update endpoint to change configuration parameters.
 */

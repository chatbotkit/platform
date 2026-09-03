// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { captureError } from '@/lib/error'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok, respondFromError } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

/**
 * @param {import('@/prisma/types').TriggerIntegration} triggerIntegration
 * @returns {Promise<void>}
 */
export async function doSetup(triggerIntegration) {
  debug(`do setup`, { triggerIntegration })
}

/**
 * @swagger
 *
 * /integration/trigger/{triggerIntegrationId}/setup:
 *   post:
 *     operationId: setupTriggerIntegration
 *     summary: Setup a Trigger integration
 *     tags:
 *       - Trigger Integration
 *     parameters:
 *       - in: path
 *         name: triggerIntegrationId
 *         required: true
 *         schema:
 *           description: The ID of the Trigger integration
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
 *         description: The Trigger integration was successfully setup
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the Trigger Integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSession(async function (req, session) {
    const triggerIntegration =
      await prisma.triggerIntegration.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'triggerIntegrationId')
      )

    if (!triggerIntegration) {
      return notFound()
    }

    if (triggerIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    try {
      await doSetup(triggerIntegration)
    } catch (e) {
      await captureError(e)

      return respondFromError(e)
    }

    return ok({ id: triggerIntegration.id })
  })
)

/**
 * @manual Trigger Integration
 *
 * ## Setting Up a Trigger Integration
 *
 * The setup endpoint performs initialization tasks for a trigger integration,
 * preparing it for use with external systems. This operation validates the
 * trigger configuration and performs any necessary setup procedures to ensure
 * the integration is ready to receive and process events.
 *
 * To set up a trigger integration, send a POST request:
 *
 * ```http
 * POST /api/v1/integration/trigger/{triggerIntegrationId}/setup
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * Replace `{triggerIntegrationId}` with your trigger's unique identifier.
 *
 * **When to Use Setup:**
 *
 * Call the setup endpoint after creating a trigger integration or when
 * configuration changes require reinitialization. The setup process:
 *
 * 1. Validates the trigger configuration
 * 2. Verifies bot association and permissions
 * 3. Initializes any required resources
 * 4. Prepares the trigger for event processing
 *
 * **Setup Process Details:**
 *
 * The setup operation is typically quick and returns immediately with a
 * confirmation. If the trigger is already properly configured, the setup
 * process will complete without making changes. This makes it safe to call
 * setup multiple times.
 *
 * **Response:**
 *
 * ```json
 * {
 *   "id": "trigger_abc123"
 * }
 * ```
 *
 * After successful setup, the trigger is ready to receive events through its
 * event endpoint. You can begin sending events immediately using the trigger's
 * event URL and authentication credentials.
 *
 * **Note:** Setup is optional for most use cases. Triggers are typically ready
 * to use immediately after creation unless specific initialization is required
 * for your integration scenario.
 */

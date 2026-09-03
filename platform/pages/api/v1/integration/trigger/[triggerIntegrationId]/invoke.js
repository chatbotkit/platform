// @ts-check
import prisma from '@/prisma/client'

import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import { INVOKE_EVENT_TYPE, sendEvent } from './queue'

/**
 * @swagger
 *
 * /integration/trigger/{triggerIntegrationId}/invoke:
 *   post:
 *     operationId: invokeTriggerIntegration
 *     summary: Invoke Trigger integration
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
 *         description: The Trigger integration was trigged successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the trigged Trigger integration
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
        requiredUrlParam(req, 'triggerIntegrationId'),
        {
          select: {
            id: true,
            userId: true,

            schedule: true,
          },
        }
      )

    if (!triggerIntegration) {
      return notFound()
    }

    if (triggerIntegration.userId !== session.user.id) {
      return notAuthorized()
    }

    await sendEvent(triggerIntegration.id, {
      type: INVOKE_EVENT_TYPE,
      payload: {
        schedule: triggerIntegration.schedule || 'never',
      },
    })

    return ok({ id: triggerIntegration.id })
  })
)

/**
 * @manual Trigger Integration
 *
 * ## Invoking a Trigger Integration
 *
 * The invoke endpoint manually triggers execution of a trigger integration,
 * useful for testing, debugging, or forcing immediate execution outside of
 * normal event flows. This bypasses the standard event endpoint and directly
 * queues the trigger for processing with the configured schedule.
 *
 * To invoke a trigger integration, send a POST request:
 *
 * ```http
 * POST /api/v1/integration/trigger/{triggerIntegrationId}/invoke
 * Content-Type: application/json
 *
 * {}
 * ```
 *
 * Replace `{triggerIntegrationId}` with your trigger's unique identifier.
 *
 * **Use Cases for Manual Invocation:**
 *
 * - **Testing**: Verify that your trigger configuration works correctly
 * - **Debugging**: Troubleshoot trigger behavior without external dependencies
 * - **Manual Execution**: Force trigger execution outside of scheduled times
 * - **Development**: Test trigger workflows during development and integration
 *
 * **How Invocation Works:**
 *
 * When you invoke a trigger, the system:
 *
 * 1. Queues an invoke event for the trigger
 * 2. Processes the event using the trigger's configured schedule settings
 * 3. Executes the associated bot with the trigger context
 * 4. Records the interaction in conversation history
 *
 * **Invoke vs Event Endpoint:**
 *
 * The invoke endpoint differs from the standard event endpoint:
 *
 * - **Invoke**: Administrative operation for testing and manual execution
 * - **Event**: Production endpoint for receiving external events with custom payloads
 *
 * Use the event endpoint (`/event`) for normal trigger operations where you
 * need to pass custom data and payloads. Use invoke for testing and manual
 * execution scenarios.
 *
 * **Response:**
 *
 * ```json
 * {
 *   "id": "trigger_abc123"
 * }
 * ```
 *
 * The response confirms that the trigger has been queued for execution. The
 * actual processing happens asynchronously in the background. Monitor the
 * Conversations tab to see the results of the triggered execution.
 *
 * **Note:** If the trigger has a configured schedule (`schedule`), the
 * invocation will respect that schedule's settings during execution.
 */

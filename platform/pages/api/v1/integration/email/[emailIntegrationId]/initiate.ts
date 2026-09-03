import prisma from '@/prisma/client'

import { withStream } from '@/lib/stream'
import schema, { withSchema } from '@/lib/joi.handler'
import { withSessionLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import {
  throwBadRequest,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'

import { INITIATE_EVENT_TYPE, sendEvent } from './queue'

export const bodySchema = schema.object({
  email: schema.string().trim().email(),
  subject: schema.string().trim().min(1),
  text: schema.string().trim().min(1),
})

/**
 * @swagger
 *
 * /integration/email/{emailIntegrationId}/initiate:
 *   post:
 *     operationId: initiateEmail
 *     summary: Initiates conversation with the email integration
 *     tags:
 *       - Conversation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 description: The email address to use for the conversation
 *                 type: string
 *                 format: email
 *               subject:
 *                 description: The subject of the email
 *                 type: string
 *               text:
 *                 description: The text instruction to use to initiate the conversation
 *                 type: string
 *             required:
 *               - text
 *               - email
 *               - subject
 *     responses:
 *       200:
 *         description: The email integration was successfully initiated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   description: The ID of the initiated integration
 *                   type: string
 *               required:
 *                 - id
 *       default:
 *         $ref: '#/components/responses/ErrorResponse'
 */
export default withPost(
  withSessionLimits(
    ['special/rate/initiate', 'rate/message', 'message', 'token'],
    withSchema(
      bodySchema,
      withStream(async function (req, stream, session, body) {
        const { email, subject, text } = body

        const emailIntegration =
          await prisma.emailIntegration.findUniqueByIdentifier(
            session.user,
            requiredUrlParam(req, 'emailIntegrationId')
          )

        if (!emailIntegration) {
          return throwNotFound()
        }

        if (emailIntegration.userId !== session.user.id) {
          return throwNotAuthorized()
        }

        if (!emailIntegration.botId) {
          throwBadRequest('Email integration does not have a bot configured')
        }

        await sendEvent(emailIntegration.id, {
          type: INITIATE_EVENT_TYPE,
          payload: {
            email,
            subject,
            text,
          },
        })

        await stream.result({
          id: emailIntegration.id,
        })
      })
    )
  )
)

/**
 * @manual Email Integration
 *
 * ## Initiating a Conversation via Email
 *
 * The Email initiate endpoint lets you programmatically start a new AI-powered
 * conversation by sending an outbound email to any recipient. Unlike the standard
 * email parsing flow where conversations are triggered by inbound messages, this
 * endpoint enables proactive outreach - your system can send an email and have the
 * bot respond to any replies that come back through the integration.
 *
 * This is particularly useful for automated follow-up sequences, onboarding emails,
 * support escalations where the AI proactively reaches out, and any workflow where
 * your application needs to open a dialogue with an external contact via email.
 *
 * The `email` parameter specifies the recipient's address, `subject` sets the email
 * subject line, and `text` provides an instruction that guides the bot on how to
 * compose the opening message. The bot uses this instruction to craft a contextually
 * appropriate email rather than sending the instruction text verbatim.
 *
 * ```http
 * POST /api/v1/integration/email/{emailIntegrationId}/initiate
 * Content-Type: application/json
 *
 * {
 *   "email": "customer@example.com",
 *   "subject": "Following up on your recent support request",
 *   "text": "Follow up with the customer about their ticket #4521 and ask if the issue was resolved"
 * }
 * ```
 *
 * A successful response returns the integration ID confirming the initiation was queued:
 *
 * ```json
 * {
 *   "id": "email-integration-id"
 * }
 * ```
 *
 * **Required parameters:**
 *
 * - `email` - A valid email address for the intended recipient
 * - `subject` - The subject line for the outgoing email
 * - `text` - The instruction text that guides the bot's opening email content
 *
 * **Prerequisites:** The Email integration must have a bot configured before calling
 * this endpoint. If no bot is assigned, the request returns a `400 Bad Request` error.
 * Verify that your integration is fully set up using the setup endpoint beforehand.
 *
 * **Reply handling:** Once the recipient replies to the initiated email, the reply is
 * routed back through the standard email parsing mechanism and handled as a regular
 * inbound message to maintain the conversation.
 */

import prisma from '@/prisma/client'

import cuid from '@/lib/cuid'
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

function normalizeWhatsAppRecipient(value: string): string {
  const digits = value.replace(/\D/g, '')

  if (digits.length < 7 || digits.length > 15) {
    throw new Error('Invalid WhatsApp recipient phone number')
  }

  return digits
}

export const bodySchema = schema.object({
  to: schema.string().trim().custom(normalizeWhatsAppRecipient),
  text: schema.string().trim().min(1),
  idempotencyKey: schema
    .string()
    .trim()
    .pattern(/^[A-Za-z0-9_-]{1,128}$/)
    .optional(),
})

/**
 * @swagger
 *
 * /integration/whatsapp/{whatsappIntegrationId}/initiate:
 *   post:
 *     operationId: initiateWhatsapp
 *     summary: Initiates conversation with the whatsapp integration
 *     tags:
 *       - Conversation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               to:
 *                 description: The recipient phone number in E.164 format, without the leading plus sign
 *                 type: string
 *               text:
 *                 description: The free-form text message to send within an active WhatsApp customer service window
 *                 type: string
 *               idempotencyKey:
 *                 description: A stable caller-supplied key used to prevent duplicate proactive messages when retrying the request
 *                 type: string
 *             required:
 *               - to
 *               - text
 *     responses:
 *       200:
 *         description: The whatsapp integration was successfully initiated
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
        const { to, text, idempotencyKey } = body

        const whatsappIntegration =
          await prisma.whatsappIntegration.findUniqueByIdentifier(
            session.user,
            requiredUrlParam(req, 'whatsappIntegrationId')
          )

        if (!whatsappIntegration) {
          return throwNotFound()
        }

        if (whatsappIntegration.userId !== session.user.id) {
          return throwNotAuthorized()
        }

        if (!whatsappIntegration.botId) {
          throwBadRequest('WhatsApp integration does not have a bot configured')
        }

        if (!whatsappIntegration.accessToken) {
          throwBadRequest('WhatsApp integration does not have an access token')
        }

        if (!whatsappIntegration.phoneNumberId) {
          throwBadRequest(
            'WhatsApp integration does not have a phone number ID configured'
          )
        }

        await sendEvent(whatsappIntegration.id, {
          type: INITIATE_EVENT_TYPE,
          payload: {
            id: idempotencyKey || cuid(),
            to,
            text,
          },
        })

        await stream.result({
          id: whatsappIntegration.id,
        })
      })
    )
  )
)

/**
 * @manual WhatsApp Integration
 *
 * ## Initiating a Conversation via WhatsApp
 *
 * The WhatsApp initiate endpoint sends a free-form text message to a WhatsApp
 * recipient through the configured WhatsApp Cloud API phone number and creates a
 * ChatBotKit conversation for subsequent replies.
 *
 * This endpoint is intentionally limited to WhatsApp's customer service window.
 * WhatsApp only allows free-form text messages after a user has messaged the
 * business and while the customer service window is open. Messages outside that
 * window must use an approved WhatsApp message template, which this endpoint does
 * not send.
 *
 * ```http
 * POST /api/v1/integration/whatsapp/{whatsappIntegrationId}/initiate
 * Content-Type: application/json
 *
 * {
 *   "to": "14155238886",
 *   "text": "Your order is ready. Would you like pickup instructions?"
 * }
 * ```
 *
 * A successful response returns the integration ID confirming the initiation was
 * queued:
 *
 * ```json
 * {
 *   "id": "whatsapp-integration-id"
 * }
 * ```
 *
 * **Required parameters:**
 *
 * - `to` - The recipient phone number in E.164 format. A leading `+` is accepted
 *   in the request and normalized away before calling WhatsApp.
 * - `text` - The free-form message body to send.
 * - `idempotencyKey` - An optional stable key to reuse when retrying a request.
 *   If omitted, ChatBotKit generates a delivery ID for queue-level retries.
 *
 * **Prerequisites:** The WhatsApp integration must have a bot configured, an
 * access token, and a phone number ID. Missing configuration returns a
 * `400 Bad Request` error.
 *
 * **Provider constraint:** Do not use this endpoint for cold outbound messages.
 * Use approved WhatsApp message templates for conversations outside the active
 * customer service window.
 */

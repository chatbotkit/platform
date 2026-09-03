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
import { normalizeTwilioMessageAddress } from '@/lib/twilio.phone'

import { INITIATE_EVENT_TYPE, sendEvent } from './queue'

export const bodySchema = schema.object({
  channel: schema.string().valid('sms', 'call').default('sms'),
  from: schema.string().custom((value) => {
    const normalized = normalizeTwilioMessageAddress(value, {
      allowAlphanumericSender: true,
    })

    if (!normalized) {
      throw new Error('Invalid Twilio sender address')
    }

    return normalized
  }),
  to: schema.string().custom((value) => {
    const normalized = normalizeTwilioMessageAddress(value)

    if (!normalized) {
      throw new Error('Invalid Twilio recipient address')
    }

    return normalized
  }),
  text: schema.string().trim().min(1),
})

/**
 * @swagger
 *
 * /integration/twilio/{twilioIntegrationId}/initiate:
 *   post:
 *     operationId: initiateTwilio
 *     summary: Initiates conversation with the twilio integration
 *     tags:
 *       - Conversation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               channel:
 *                 description: The Twilio channel to use for the conversation
 *                 type: string
 *                 enum:
 *                   - sms
 *                   - call
 *                 default: sms
 *               from:
 *                 description: The Twilio sender phone number
 *                 type: string
 *               to:
 *                 description: The recipient phone number
 *                 type: string
 *               text:
 *                 description: The text instruction to use to initiate the conversation
 *                 type: string
 *             required:
 *               - from
 *               - to
 *               - text
 *     responses:
 *       200:
 *         description: The twilio integration was successfully initiated
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
        const { channel = 'sms', from, to, text } = body

        const twilioIntegration =
          await prisma.twilioIntegration.findUniqueByIdentifier(
            session.user,
            requiredUrlParam(req, 'twilioIntegrationId')
          )

        if (!twilioIntegration) {
          return throwNotFound()
        }

        if (twilioIntegration.userId !== session.user.id) {
          return throwNotAuthorized()
        }

        if (!twilioIntegration.botId) {
          throwBadRequest('Twilio integration does not have a bot configured')
        }

        if (!twilioIntegration.accountSid || !twilioIntegration.authToken) {
          throwBadRequest(
            'Twilio integration does not have delivery credentials configured'
          )
        }

        await sendEvent(twilioIntegration.id, {
          type: INITIATE_EVENT_TYPE,
          payload: {
            channel,
            from,
            to,
            text,
          },
        })

        await stream.result({
          id: twilioIntegration.id,
        })
      })
    )
  )
)

/**
 * @manual Twilio Integration
 *
 * ## Initiating a Conversation via Twilio
 *
 * The Twilio initiate endpoint enables your application to proactively start an
 * AI-powered conversation over SMS or voice call without waiting for an inbound
 * message. This supports use cases such as appointment reminders, delivery
 * notifications, two-factor authentication follow-ups, and any scenario where
 * your system needs to reach out to a phone number and engage the recipient in
 * an intelligent conversation.
 *
 * The endpoint supports two channels: `sms` (the default) for text message
 * conversations and `call` for voice interactions. The `from` parameter must be
 * a valid Twilio phone number or alphanumeric sender ID that is configured on
 * your Twilio account. The `to` parameter is the recipient's phone number in
 * E.164 format (e.g., `+15551234567`). The `text` parameter is an instruction
 * used by the bot to generate the opening message - it is not sent verbatim.
 *
 * ```http
 * POST /api/v1/integration/twilio/{twilioIntegrationId}/initiate
 * Content-Type: application/json
 *
 * {
 *   "channel": "sms",
 *   "from": "+15550001111",
 *   "to": "+15559998888",
 *   "text": "Remind the customer their appointment is tomorrow at 10am and ask if they need to reschedule"
 * }
 * ```
 *
 * A successful response returns the integration ID confirming the initiation was queued:
 *
 * ```json
 * {
 *   "id": "twilio-integration-id"
 * }
 * ```
 *
 * **Required parameters:**
 *
 * - `from` - A valid Twilio sender phone number or alphanumeric sender ID
 * - `to` - The recipient's phone number in E.164 format
 * - `text` - The instruction text that guides the bot's opening message
 *
 * **Optional parameters:**
 *
 * - `channel` - Either `sms` (default) or `call`
 *
 * **Prerequisites:** The Twilio integration must have a bot configured and valid
 * Twilio credentials (Account SID and Auth Token) stored. Missing credentials
 * result in a `400 Bad Request` error. Ensure the integration is fully configured
 * using the setup endpoint before calling initiate.
 *
 * **Phone number format:** Both `from` and `to` numbers are validated and normalized
 * to E.164 format. Invalid phone number formats will result in a validation error.
 * Alphanumeric sender IDs are supported for the `from` field where allowed by
 * Twilio and local regulations.
 */

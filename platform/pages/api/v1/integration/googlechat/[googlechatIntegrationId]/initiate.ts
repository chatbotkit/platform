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
  space: schema.string().trim().min(1).required(),
  text: schema.string().trim().min(1).required(),
}).unknown(false)

/**
 * @swagger
 *
 * /integration/googlechat/{googlechatIntegrationId}/initiate:
 *   post:
 *     operationId: initiateGooglechat
 *     summary: Initiates conversation with the googlechat integration
 *     tags:
 *       - Conversation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               space:
 *                 description: The Google Chat space resource name to send to, such as spaces/AAAA..., or a Google Chat user identifier for a direct message
 *                 type: string
 *               text:
 *                 description: The text message to send to the Google Chat space
 *                 type: string
 *             required:
 *               - text
 *     responses:
 *       200:
 *         description: The googlechat integration was successfully initiated
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
        const { space, text } = body

        const googlechatIntegration =
          await prisma.googlechatIntegration.findUniqueByIdentifier(
            session.user,
            requiredUrlParam(req, 'googlechatIntegrationId')
          )

        if (!googlechatIntegration) {
          return throwNotFound()
        }

        if (googlechatIntegration.userId !== session.user.id) {
          return throwNotAuthorized()
        }

        if (!googlechatIntegration.botId) {
          throwBadRequest(
            'Google Chat integration does not have a bot configured'
          )
        }

        if (!googlechatIntegration.serviceAccountKey) {
          throwBadRequest(
            'Google Chat integration does not have a service account key'
          )
        }

        await sendEvent(googlechatIntegration.id, {
          type: INITIATE_EVENT_TYPE,
          payload: {
            space,
            text,
          },
        })

        await stream.result({
          id: googlechatIntegration.id,
        })
      })
    )
  )
)

/**
 * @manual Google Chat Integration
 *
 * ## Initiating a Google Chat Message
 *
 * The Google Chat initiate endpoint sends a message from the configured Chat
 * app to an existing Google Chat space. The target can be a direct message or
 * a shared space that the Chat app can access.
 *
 * ```http
 * POST /api/v1/integration/googlechat/{googlechatIntegrationId}/initiate
 * Content-Type: application/json
 *
 * {
 *   "space": "spaces/AAAA...",
 *   "text": "The weekly deployment summary is ready. Ask if anyone wants details."
 * }
 * ```
 *
 * To send a direct message by user, provide the user's Google Chat identifier
 * as `space`:
 *
 * ```http
 * POST /api/v1/integration/googlechat/{googlechatIntegrationId}/initiate
 * Content-Type: application/json
 *
 * {
 *   "space": "person@example.com",
 *   "text": "The weekly deployment summary is ready. Ask if anyone wants details."
 * }
 * ```
 *
 * **Required parameters:**
 *
 * - `text` - The message body to send
 * - `space` - The Google Chat space resource name where the app should post,
 *   or a Google Chat user identifier for a direct message
 *
 * **Prerequisites:** The Google Chat integration must have a bot configured and
 * a service account key with access to the Chat API. The Chat app must already
 * have access to the target space or direct message.
 */

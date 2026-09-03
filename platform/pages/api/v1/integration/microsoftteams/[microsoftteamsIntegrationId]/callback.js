// @ts-check
import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { logEvent } from '@/lib/log'
import { withAny } from '@/lib/method'
import { verifyBotFrameworkToken } from '@/lib/microsoftteams.auth'
import {
  normalizeConversationId,
  stripMentionTags,
} from '@/lib/microsoftteams.markdown'
import { requiredUrlParam } from '@/lib/query.get'
import { parseRequestJson } from '@/lib/request'
import {
  CONFLICT_STATUS,
  NOT_AUTHORIZED_STATUS,
  conflict,
  notAuthorized,
  notFound,
  ok,
} from '@/lib/response'

import { sendEvent } from '@/pages/api/v1/integration/microsoftteams/[microsoftteamsIntegrationId]/queue'

/**
 * The callback endpoint handles incoming Bot Framework activities from
 * Microsoft Teams. The Bot Framework sends POST requests to this endpoint
 * whenever users send messages to the bot in Teams channels, group chats,
 * or direct messages.
 *
 * Bot Framework requires the endpoint to respond within a reasonable time.
 * Complex operations are queued for async processing.
 */
export default withAny(async function (req) {
  const microsoftteamsIntegrationId = requiredUrlParam(
    req,
    'microsoftteamsIntegrationId'
  )

  const microsoftteamsIntegration =
    await prisma.microsoftteamsIntegration.findUnique({
      where: {
        id: microsoftteamsIntegrationId,
      },
    })

  if (!microsoftteamsIntegration) {
    return notFound()
  }

  const { userId, botFrameworkAppId } = microsoftteamsIntegration

  if (!botFrameworkAppId) {
    await logEvent({
      user: { id: userId },
      type: 'integration.microsoftteams.configuration.error',
      relations: {
        microsoftteamsIntegrationId,
      },
      meta: {
        status: CONFLICT_STATUS,
        reason: 'The Bot Framework App ID is missing.',
      },
    })

    return conflict()
  }

  // validate the Bearer token from Bot Framework

  const authHeader =
    req.headers?.get?.('authorization') || req.headers?.['authorization'] || ''

  const isValid = await verifyBotFrameworkToken(authHeader, botFrameworkAppId)

  if (!isValid) {
    await logEvent({
      user: { id: userId },
      type: 'integration.microsoftteams.callback.unauthorized',
      relations: {
        microsoftteamsIntegrationId,
      },
      meta: {
        status: NOT_AUTHORIZED_STATUS,
        reason: 'The Bot Framework token validation failed.',
      },
    })

    return notAuthorized()
  }

  let body

  if (req.method === 'GET') {
    body = {}
  } else {
    body = await parseRequestJson(req)
  }

  debug(`received callback`, { body }).log(
    'integration.microsoftteams.callback.withAny'
  )

  // @see https://learn.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-activities

  const activityType = body?.type

  if (activityType === 'message') {
    const rawText = body.text?.trim() || ''
    const text = stripMentionTags(rawText)
    const fromId = body.from?.id
    const fromName = body.from?.name
    const rawConversationId = body.conversation?.id || ''
    const conversationId = normalizeConversationId(rawConversationId)
    const serviceUrl = body.serviceUrl

    if (text && fromId && conversationId && serviceUrl) {
      await logEvent({
        user: { id: userId },
        type: 'integration.microsoftteams.callback.message',
        relations: {
          blueprintId: microsoftteamsIntegration.blueprintId,
          botId: microsoftteamsIntegration.botId,
          microsoftteamsIntegrationId: microsoftteamsIntegration.id,
        },
        meta: {},
      })

      await sendEvent(microsoftteamsIntegrationId, {
        type: 'interact',
        payload: {
          activityId: body.id,
          conversationId,
          serviceUrl,
          fromId,
          fromName: fromName || '',
          message: text,
        },
      })
    }
  } else if (
    activityType === 'conversationUpdate' ||
    activityType === 'installationUpdate'
  ) {
    await logEvent({
      user: { id: userId },
      // @ts-ignore narrowed to conversationUpdate | installationUpdate above
      type: `integration.microsoftteams.callback.${activityType}`,
      relations: {
        microsoftteamsIntegrationId: microsoftteamsIntegration.id,
      },
      meta: {},
    })
  }

  // @note always return 200 to acknowledge receipt

  return ok()
})

/**
 * @manual Microsoft Teams Integration
 * @index 60
 *
 * ## Webhook Callbacks and Event Handling
 *
 * The callback endpoint receives Bot Framework activity notifications from
 * Microsoft Teams. This endpoint serves as the messaging endpoint configured
 * in the Azure Bot Service, bridging Teams messaging with ChatBotKit's
 * conversational AI.
 *
 * Microsoft Bot Framework sends activity objects to this endpoint whenever
 * users interact with the bot in Teams channels, group chats, or direct
 * messages. The endpoint handles authentication, activity parsing, and
 * queuing messages for asynchronous processing.
 *
 * ### Authentication
 *
 * Every request from Bot Framework includes a Bearer token in the
 * Authorization header. The endpoint validates this JWT token against
 * Microsoft's OpenID metadata to ensure the request is authentic. Requests
 * with missing or invalid tokens are rejected with a 401 response.
 *
 * ### Supported Activity Types
 *
 * **Message Activities**: User-sent text messages are extracted and queued
 * for processing by the conversational AI engine.
 *
 * **Conversation Update Activities**: Events like members being added or
 * removed from a conversation are logged for monitoring.
 *
 * **Installation Update Activities**: Events related to the bot being
 * installed or uninstalled are logged.
 *
 * ### Webhook Troubleshooting
 *
 * **Authentication Failures**: If callback requests fail authentication:
 * - Verify the Bot Framework App ID matches your Azure Bot registration
 * - Ensure the messaging endpoint URL in Azure Bot Service points to your
 *   integration's callback URL
 * - Check that the App Secret is correctly configured
 *
 * **Message Processing Issues**: If messages aren't being processed:
 * - Check event logs for callback delivery confirmations
 * - Verify the bot has been properly added to the Teams channel or chat
 * - Ensure the Bot Framework App ID and Secret are valid
 */

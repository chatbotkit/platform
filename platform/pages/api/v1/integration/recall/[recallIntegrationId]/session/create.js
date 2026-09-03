// @ts-check
import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { createConversation } from '@/lib/conversation.create'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { getRecallMeetingSeed } from '@/lib/recall.bot'
import { RECALL_SEND_AVATAR_MESSAGE_FUNCTION_NAME } from '@/lib/recall.constants'
import {
  getRecallMeetingSession,
  updateRecallMeetingSession,
} from '@/lib/recall.session'
import { conflict, notAuthenticated, notFound, ok } from '@/lib/response'

import { createConversationSessionToken } from '@/pages/api/v1/conversation/[conversationId]/session/create'

export const bodySchema = schema.object({
  sessionId: schema.string().trim().allow('').optional(),
})

export default withPost(
  withSchema(bodySchema, async function (req, body) {
    const recallIntegrationId = requiredUrlParam(req, 'recallIntegrationId')

    const sessionId = body.sessionId || ''

    const recallSession = sessionId
      ? await getRecallMeetingSession(sessionId)
      : null

    if (
      !recallSession ||
      recallSession.recallIntegrationId !== recallIntegrationId
    ) {
      return notAuthenticated()
    }

    const recallIntegration = await prisma.recallIntegration.findUnique({
      where: {
        id: recallIntegrationId,
      },

      select: {
        id: true,
        userId: true,
        botId: true,
        apiKey: true,
        region: true,
      },
    })

    if (!recallIntegration) {
      return notFound()
    }

    if (!recallIntegration.apiKey) {
      return conflict('Recall integration requires an API key')
    }

    if (!recallIntegration.botId) {
      return conflict('Recall integration requires a bot')
    }

    if (recallSession.userId !== recallIntegration.userId) {
      return notAuthenticated()
    }

    const { id: conversationId } = await createConversation(
      recallIntegration.userId,
      {
        botId: recallIntegration.botId,

        meta: {
          app: 'recall',

          recall: {
            integrationId: recallIntegration.id,
          },
        },
      }
    )

    // Persist the conversation id on the session so the bot status webhook
    // can append a final activity message when `bot.call_ended` fires.
    await updateRecallMeetingSession(recallSession.id, {
      conversationId,
    })

    const token = await createConversationSessionToken({
      conversationId,
      userId: recallIntegration.userId,
      durationInSeconds: ONE_HOUR_IN_SECONDS,
      extra: {
        options: {
          engine: {
            features:
              /** @type {import('@/lib/conversation.engine').Feature[]} */ ([
                { name: 'silent' },
                {
                  name: 'backstory',
                  options: {
                    mode: 'extend',
                    text: `# Meeting Assistant Instructions

Keep in mind that you are a special-purpose meeting assistant with access to a number of tools.

Your purpose is to manage the meeting and provide a seamless experience.

You cannot directly interact with the user, and must use the tools at your disposal to perform any necessary actions.

The meeting agent may also be called the bot, avatar, agent or AI agent by meeting participants.

When you receive a meeting transcript turn or chat message, decide whether that input is meant for the agent.

If the agent should respond, call the ${RECALL_SEND_AVATAR_MESSAGE_FUNCTION_NAME} function with the exact message the agent should answer.

If the agent should not respond, do not call any function and do not produce a user-facing reply.`,
                  },
                },
              ]),
          },
        },
      },
    })

    const expiresAt = Date.now() + ONE_HOUR_IN_SECONDS * 1000

    const meeting = await getRecallMeetingSeed({
      apiKey: recallIntegration.apiKey,
      region: recallIntegration.region,
      recallBotId: recallSession.recallBotId,
    })

    return ok({
      id: recallIntegration.id,

      conversationId,
      token,

      expiresAt,

      meeting,
    })
  })
)

// @note not a public method and it should not be documented or exposed

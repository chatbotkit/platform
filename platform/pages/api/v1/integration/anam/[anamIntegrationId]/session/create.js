/* eslint-disable custom-eslint-rules/no-plain-fetch-in-routes -- fixed vendor endpoint (Anam) */
// @ts-check
import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'
import { Visibility } from '@/prisma/enums'

import { canUseAnamIntegration } from '@/lib/anam.access'
import { signAnamSession } from '@/lib/anam.session'
import { createConversation } from '@/lib/conversation.create'
import fetch from '@/lib/fetch'
import schema, { withSchema } from '@/lib/joi.handler'
import { tryParse } from '@/lib/json'
import { checkLimits } from '@/lib/limit.core'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import {
  badRequest,
  conflict,
  notAuthenticated,
  notAuthorized,
  notFound,
  ok,
  respondFromError,
} from '@/lib/response'
import { getSession } from '@/lib/session.get'
import { fastGetUserById } from '@/lib/user.get'

import { createConversationSessionToken } from '@/pages/api/v1/conversation/[conversationId]/session/create'

export const bodySchema = schema.object({})

export async function createAnamIntegrationSession({ anamIntegrationId, req }) {
  const anamIntegration = await prisma.anamIntegration.findUnique({
    where: {
      id: anamIntegrationId,
    },

    select: {
      id: true,
      userId: true,
      botId: true,
      apiKey: true,
      personaId: true,
      visibility: true,
    },
  })

  if (!anamIntegration) {
    return notFound()
  }

  if (anamIntegration.visibility !== Visibility.public) {
    if (!req) {
      return notAuthenticated()
    }

    let session

    try {
      session = await getSession(req)
    } catch (error) {
      return respondFromError(error)
    }

    if (!(await canUseAnamIntegration(session.user.id, anamIntegration))) {
      return notAuthorized()
    }
  }

  if (!anamIntegration.apiKey) {
    return conflict('Anam integration requires an API key')
  }

  if (!anamIntegration.personaId) {
    return conflict('Anam integration requires a persona')
  }

  if (!anamIntegration.botId) {
    return conflict('Anam integration requires a bot')
  }

  const [user, bot] = await Promise.all([
    fastGetUserById(anamIntegration.userId),
    prisma.bot.findUnique({
      where: {
        id: anamIntegration.botId,
      },
    }),
  ])

  if (!user) {
    return badRequest({
      message: 'Anam integration owner not found',
      code: 'ANAM_INTEGRATION_USER_NOT_FOUND',
    })
  }

  if (!bot || bot.userId !== anamIntegration.userId) {
    return conflict('Anam integration requires a valid bot')
  }

  // @note these endpoints can be called anonymously for public integrations,
  // so we rate limit against the integration owner who bears the cost of the
  // upstream Anam calls and the conversation that gets created

  try {
    await checkLimits(['rate/conversation', 'conversation', 'message'], user)
  } catch (error) {
    return respondFromError(error)
  }

  const personaResponse = await fetch(
    `https://api.anam.ai/v1/personas/${encodeURIComponent(
      anamIntegration.personaId
    )}`,
    {
      method: 'GET',

      headers: {
        Authorization: `Bearer ${anamIntegration.apiKey}`,
      },
    }
  )

  const personaText = await personaResponse.text()
  const personaData = tryParse(personaText) || { message: personaText }

  if (!personaResponse.ok) {
    return badRequest({
      message: personaData?.message || 'Failed to fetch Anam persona',
      code: 'ANAM_PERSONA_FETCH_FAILED',
    })
  }

  const avatarId = personaData?.avatar?.id
  const voiceId = personaData?.voice?.id

  if (!avatarId || !voiceId) {
    return conflict('Anam persona requires an avatar and voice')
  }

  const response = await fetch('https://api.anam.ai/v1/auth/session-token', {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anamIntegration.apiKey}`,
    },

    body: JSON.stringify({
      personaConfig: {
        name: personaData?.name || 'ChatBotKit',
        avatarId,
        voiceId,
        llmId: 'CUSTOMER_CLIENT_V1',
      },
    }),
  })

  const text = await response.text()
  const data = tryParse(text) || { message: text }

  if (!response.ok) {
    return badRequest({
      message: data?.message || 'Failed to create Anam session token',
      code: 'ANAM_SESSION_TOKEN_FAILED',
    })
  }

  if (!data.sessionToken) {
    return badRequest({
      message: 'Failed to create Anam session token',
      code: 'ANAM_SESSION_TOKEN_FAILED',
    })
  }

  const { id: conversationId } = await createConversation(
    anamIntegration.userId,
    {
      botId: anamIntegration.botId,

      meta: {
        app: 'anam',

        anam: {
          integrationId: anamIntegration.id,
        },
      },
    }
  )

  const token = await createConversationSessionToken({
    conversationId,
    userId: anamIntegration.userId,
    durationInSeconds: ONE_HOUR_IN_SECONDS,
    extra: {
      options: {
        engine: {
          features:
            /** @type {import('@/lib/conversation.engine').Feature[]} */ (
              [
                // @note add features here if needed
              ]
            ),
        },
      },
    },
  })

  const frameSession = {
    anamIntegrationId: anamIntegration.id,

    conversationId,
    token,

    anamSessionToken: data.sessionToken,
  }

  return ok({
    ...frameSession,

    session: await signAnamSession(frameSession, ONE_HOUR_IN_SECONDS),
  })
}

export default withPost(
  withSchema(bodySchema, async function (req) {
    return createAnamIntegrationSession({
      anamIntegrationId: requiredUrlParam(req, 'anamIntegrationId'),
      req,
    })
  })
)

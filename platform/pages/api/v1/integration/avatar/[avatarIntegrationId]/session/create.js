// @ts-check
import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'
import { Visibility } from '@/prisma/enums'

import { NONE_AUDIENCE } from '@/lib/audience.consts'
import { canUseAvatarIntegration } from '@/lib/avatar.access'
import { signAvatarSession } from '@/lib/avatar.session'
import { createSpan } from '@/lib/debug'
import schema, { withSchema } from '@/lib/joi.handler'
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
import { getRandomId } from '@/lib/string'
import { fastGetUserById } from '@/lib/user.get'

import { createBotRealtimeWebsocketSession } from '@/pages/api/v1/bot/[botId]/realtime/websocket/create'

export const bodySchema = schema.object({})

export async function createAvatarIntegrationRealtimeSession({
  avatarIntegrationId,
  req,
}) {
  const span = createSpan({ name: 'createAvatarIntegrationRealtimeSession' })

  try {
    const avatarIntegration = await prisma.avatarIntegration.findUnique({
      where: {
        id: avatarIntegrationId,
      },

      select: {
        id: true,
        userId: true,
        botId: true,
        visibility: true,
      },
    })

    if (!avatarIntegration) {
      return notFound()
    }

    if (avatarIntegration.visibility !== Visibility.public) {
      if (!req) {
        return notAuthenticated()
      }

      let session

      try {
        session = await getSession(req)
      } catch (error) {
        return respondFromError(error)
      }

      if (
        !(await canUseAvatarIntegration(session.user.id, avatarIntegration))
      ) {
        return notAuthorized()
      }
    }

    if (!avatarIntegration.botId) {
      return conflict('Avatar integration requires a bot')
    }

    const [user, bot] = await Promise.all([
      fastGetUserById(avatarIntegration.userId),
      prisma.bot.findUnique({
        where: {
          id: avatarIntegration.botId,
        },

        include: {
          // pass
        },
      }),
    ])

    if (!user) {
      return badRequest({
        message: 'Avatar integration owner not found',
        code: 'AVATAR_INTEGRATION_USER_NOT_FOUND',
      })
    }

    if (!bot || bot.userId !== avatarIntegration.userId) {
      return conflict('Avatar integration requires a valid bot')
    }

    // @note these endpoints can be called anonymously for public integrations,
    // so we rate limit against the integration owner who bears the cost of the
    // realtime session and the conversation that gets created

    try {
      await checkLimits(['rate/conversation', 'conversation', 'message'], user)
    } catch (error) {
      return respondFromError(error)
    }

    const durationInSeconds = ONE_HOUR_IN_SECONDS

    const session = {
      id: getRandomId(),

      user,

      options: {},

      payload: {
        aud: NONE_AUDIENCE,
      },

      expires: new Date(Date.now() + durationInSeconds * 1000).toISOString(),
    }

    const realtime = await createBotRealtimeWebsocketSession({
      session,
      bot,
      durationInSeconds,
      meta: {
        app: 'avatar',
        avatarIntegrationId: avatarIntegration.id,
      },
    })

    const frameSession = {
      avatarIntegrationId: avatarIntegration.id,

      websocket: realtime.websocket,
    }

    return ok({
      ...frameSession,

      session: await signAvatarSession(frameSession, durationInSeconds),
    })
  } finally {
    span.finish()
  }
}

export default withPost(
  withSchema(bodySchema, async function (req) {
    return createAvatarIntegrationRealtimeSession({
      avatarIntegrationId: requiredUrlParam(req, 'avatarIntegrationId'),
      req,
    })
  })
)

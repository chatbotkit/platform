// @ts-check
import { ONE_DAY_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'

import { getConversationDetails } from '@/lib/bot.conversation'
import { createConversation } from '@/lib/conversation.create'
import debug from '@/lib/debug'
import { captureError } from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { withLimits } from '@/lib/limit.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { ok, respondFromError, throwNotFound } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import { createConversationSessionToken } from '@/pages/api/v1/conversation/[conversationId]/session/create'

export const bodySchema = schema.object({}).unknown(true)

export default withPost(
  withSession(
    withLimits(
      ['rate/conversation', 'conversation', 'message'],
      withSchema(
        bodySchema,
        /**
         * @param {Request} req
         * @param {import('@/lib/session.get').Session} session
         * @param {any} body
         */
        async function (req, session, body) {
          const {} = body

          const instance = await prisma.hubBotPage.findUnique({
            where: {
              id: requiredUrlParam(req, 'botId'),
            },

            include: {
              bot: true,
            },
          })

          if (!instance) {
            return throwNotFound()
          }

          if (!instance.bot) {
            return throwNotFound()
          }

          const details = getConversationDetails({
            bot: instance.bot,
          })

          try {
            const { id: cId } = await createConversation(
              session.user.id,
              {
                ...details,

                meta: {
                  app: 'hub',
                },
              },
              {
                bpacc: true,
              }
            )

            const token = await createConversationSessionToken({
              conversationId: cId,
              userId: session.user.id,
              durationInSeconds: ONE_DAY_IN_SECONDS,
              extra: {
                options: {
                  engine: {
                    features:
                      /** @type {import('@/lib/conversation.engine').Feature[]} */ ([
                        { name: 'bpacc' },
                      ]),
                  },
                },
              },
            })

            const expiresAt = Date.now() + ONE_DAY_IN_SECONDS * 1000

            return ok({
              id: cId,

              token: token,

              expiresAt,
            })
          } catch (e) {
            debug(`responding with error`, { e })

            await captureError(e)

            return respondFromError(e)
          }
        }
      )
    )
  )
)

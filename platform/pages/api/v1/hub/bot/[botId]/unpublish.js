// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export const bodySchema = schema.object({})

export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, _body) {
      const bot = await prisma.bot.findUniqueByIdentifier(
        session.user,
        requiredUrlParam(req, 'botId')
      )

      if (!bot) {
        return notFound()
      }

      if (bot.userId !== session.user.id) {
        return notAuthorized()
      }

      const { id } = await prisma.hubBotPage.delete({
        where: {
          botId: bot.id,
        },

        select: {
          id: true,
        },
      })

      return ok({ id: id, botId: bot.id })
    })
  )
)

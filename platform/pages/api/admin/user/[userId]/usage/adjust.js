// @ts-check
import { baseLanguageModel } from '@/config/models'

import prisma from '@/prisma/client'

import { withAdminSession } from '@/lib/admin'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { notFound, ok } from '@/lib/response'
import { recordLanguageTokenUsage } from '@/lib/usage.record'

export const bodySchema = schema.object({
  token: schema.number(),
})

export default withPost(
  withAdminSession(
    withSchema(bodySchema, async function (req, _session, body) {
      const id = requiredUrlParam(req, 'userId')

      const { token } = body

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            {
              id,
            },
            {
              email: id,
            },
          ],
        },
      })

      if (!user) {
        return notFound()
      }

      if (token) {
        // @note we use this function because it supports negative values

        await recordLanguageTokenUsage({
          user: { id: user.id },
          count: token,
          model: baseLanguageModel,
          meta: {
            comment:
              'This usage record was manually added by ChatBotKit staff.',
          },
        })
      }

      return ok({ id })
    })
  )
)

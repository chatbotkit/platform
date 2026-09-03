// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export const bodySchema = schema.object({
  id: schema.string().required(),
})

export default withPost(
  withSession(
    withSchema(bodySchema, async function (req, session, body) {
      const { id } = body

      const token = await prisma.oAuthApplicationToken.findUnique({
        where: {
          id: id,
        },
      })

      if (!token) {
        return notFound()
      }

      if (token.userId !== session.user.id) {
        return notAuthorized()
      }

      await prisma.oAuthApplicationToken.delete({
        where: {
          id: token.id,
        },
      })

      return ok({ id: token.id })
    })
  )
)

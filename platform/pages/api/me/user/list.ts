import prisma from '@/prisma/client'

import { withGet } from '@/lib/method'
import { ok } from '@/lib/response'
import { withoutUserRunasCookies } from '@/lib/runas'
import { withSession } from '@/lib/session.handler'

export default withGet(
  withoutUserRunasCookies(
    withSession(async function (_req, session) {
      const users = await prisma.user.findMany({
        where: {
          parentId: session.user.id,
        },

        orderBy: {
          createdAt: 'desc',
        },
      })

      return ok({
        items: users.map(({ id, name, description, createdAt }) => ({
          id: id,
          name: name,
          description: description,

          createdAt,
        })),
      })
    })
  )
)

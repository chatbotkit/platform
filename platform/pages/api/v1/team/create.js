// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withLimits } from '@/lib/limit.handler'
import { logAudit } from '@/lib/log'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { withUserSession } from '@/lib/session.handler'

import descriptionSchema from '@/schemas/description'
import metaSchema from '@/schemas/meta'
import nameSchema from '@/schemas/name'

export const bodySchema = schema.object({
  name: nameSchema,
  description: descriptionSchema,

  meta: metaSchema,
})

// @note method not exposed for security reasons
// @todo decide if we should expose this method later

export default withPost(
  withUserSession(
    withLimits(
      ['database/team'],
      withSchema(bodySchema, async function (_req, session, body) {
        const { name, description, meta } = body

        const { id } = await prisma.team.create({
          data: {
            userId: session.user.id,

            // basic information

            name,
            description,

            // meta and others

            meta,
          },

          select: {
            id: true,
          },
        })

        await logAudit({
          user: session.user,
          action: 'CREATE',
          oldValues: undefined,
          newValues: { name, description },
          relations: {},
          meta: {
            resource: 'team',
            teamId: id,
          },
        })

        return ok({ id })
      })
    )
  )
)

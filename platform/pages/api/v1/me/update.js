// @ts-check
import prisma from '@/prisma/client'

import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

import dbStringSchema from '@/schemas/dbString'
import dbTextSchema from '@/schemas/dbText'

// @note this endpoint is not technically required in v1 but it is here for
// consistency reasons

// @note the onboarding fields are clipped well below the raw column limits -
// channel / industry / role come from fixed pick lists, organization is a
// company name and goal is a short free-form statement
export const bodySchema = schema.object({
  channel: dbStringSchema.max(64),
  organization: dbStringSchema.max(128),
  industry: dbStringSchema.max(64),
  role: dbStringSchema.max(64),
  goal: dbTextSchema.max(2048),
})

export default withPost(
  withSession(
    withSchema(bodySchema, async function (_req, session, body) {
      const { channel, organization, industry, role, goal } = body

      await prisma.user.update({
        where: {
          id: session.user.id,
        },

        data: {
          // resource specific

          channel,
          organization,
          industry,
          role,
          goal,
        },
      })

      return ok({ id: session.user.id })
    })
  )
)

// @note this is an internal method that is not subject to manual documentation

// @ts-check
import prisma from '@/prisma/client'

import { withAdminSession } from '@/lib/admin'
import { isBillingConfigured } from '@/lib/billing.core'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { requiredUrlParam } from '@/lib/query.get'
import { badRequest, notFound, ok } from '@/lib/response'
import { deleteUser } from '@/lib/user.delete'

export const bodySchema = schema.object({
  deleteBillingCustomer: schema.boolean().default(false),
  sendDeletionEmail: schema.boolean().default(true),
})

export default withPost(
  withAdminSession(
    withSchema(bodySchema, async function (req, _session, body) {
      const id = requiredUrlParam(req, 'userId')

      if (body.deleteBillingCustomer && !isBillingConfigured()) {
        return badRequest('Billing is not configured for this deployment.')
      }

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

      await deleteUser(id, {
        deleteBillingCustomer: body.deleteBillingCustomer,
        sendDeletionEmail: body.sendDeletionEmail,
      })

      return ok({ id })
    })
  )
)

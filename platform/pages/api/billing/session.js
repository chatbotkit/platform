// @ts-check
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import prisma from '@/prisma/client'

import { canDoBilling } from '@/lib/billing.core'
import { withBilling } from '@/lib/billing.handler'
import { openBillingPortal } from '@/lib/billing.provider'
import debug from '@/lib/debug'
import { getExternalHostURL } from '@/lib/host'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { genericError, notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export const bodySchema = schema.object({
  returnTo: schema.string().allow(''),
})

export default withBilling(
  withPost(
    withSession(
      withSchema(bodySchema, async (_req, session, body) => {
        const { returnTo } = body

        debug(`session`, { returnTo })

        // The reason we do this here is because the customerId may have been
        // updated but may not be part of the session yet, thus we need to run one
        // more query to make sure. Do not remove this otherwise it will cause
        // duplicate customers to be created with the billing provider.

        const user = await prisma.user.findUnique({
          where: {
            id: session.user.id,
          },
        })

        if (!user) {
          return notFound()
        }

        if (!canDoBilling(user)) {
          return notAuthorized()
        }

        const returnUrl = new URL(getExternalHostURL())

        returnUrl.pathname = (returnTo || '')
          .replace(/^\/+/g, '')
          .replace(/[?#].*/g, '')

        const result = await openBillingPortal(prisma, user, {
          returnUrl: returnUrl.toString(),
        })

        switch (result.outcome) {
          case 'redirect': {
            return ok({ redirectUrl: result.url })
          }

          case 'failed': {
            return genericError(new Error(`Could not create billing session`))
          }

          default: {
            return assertUnreachable(result)
          }
        }
      })
    )
  )
)

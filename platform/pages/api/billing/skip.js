// @ts-check
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import prisma from '@/prisma/client'

import { canDoBilling } from '@/lib/billing.core'
import { withBilling } from '@/lib/billing.handler'
import { skipTrial } from '@/lib/billing.provider'
import { captureException } from '@/lib/error'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import { conflict, notAuthorized, notFound, ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'

export const bodySchema = schema.object({})

export default withBilling(
  withPost(
    withSession(
      withSchema(bodySchema, async (_req, session) => {
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

        /** @type {import('@/lib/billing.provider').SkipTrialResult} */
        let result

        try {
          result = await skipTrial(prisma, user)
        } catch (e) {
          await captureException(e)

          return conflict(
            'We were not able to update this subscription. Contact customer support for help.'
          )
        }

        switch (result.outcome) {
          case 'skipped': {
            return ok()
          }

          case 'not_trialing': {
            return conflict(
              'You do not have an active trial. Contact customer support for help.'
            )
          }

          case 'no_subscription': {
            return notFound(
              'We were unable to find an upgradeable subscription. Contact customer support for help.'
            )
          }

          default: {
            return assertUnreachable(result)
          }
        }
      })
    )
  )
)

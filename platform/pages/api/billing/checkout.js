// @ts-check
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import prisma from '@/prisma/client'

import { canDoBilling } from '@/lib/billing.core'
import { withBilling } from '@/lib/billing.handler'
import { startCheckout } from '@/lib/billing.provider'
import debug from '@/lib/debug'
import { getExternalHostURL } from '@/lib/host'
import schema, { withSchema } from '@/lib/joi.handler'
import { withPost } from '@/lib/method'
import {
  badRequest,
  conflict,
  genericError,
  notAuthorized,
  notFound,
  ok,
} from '@/lib/response'
import { withSession } from '@/lib/session.handler'

// @note the schema validates shape only - whether the plan names something
// this deployment sells, and whether it may be trialed, is the billing
// module's vocabulary and resolves inside `startCheckout`

export const bodySchema = schema.object({
  returnTo: schema.string().allow(''),

  plan: schema.string().required(),

  coupon: schema.string().allow(null, ''),

  trial: schema.boolean().default(false),

  referral: schema.string().allow(null, ''),
})

export default withBilling(
  withPost(
    withSession(
      withSchema(bodySchema, async (_req, session, body) => {
        const { returnTo, plan, coupon, trial, referral } = body

        debug(`checkout`, { plan, coupon, trial, referral })

        // The reason we pull the database record here is because the customerId
        // may have been updated but may not be part of the session yet, thus we
        // need to run one more query to make sure. Do not remove this otherwise
        // it will cause duplicate customers to be created with the billing provider.

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

        const result = await startCheckout(prisma, user, {
          plan,
          trial,
          coupon,
          referral,
          returnUrl: returnUrl.toString(),
        })

        switch (result.outcome) {
          case 'redirect': {
            return ok({ redirectUrl: result.url })
          }

          case 'unknown_plan': {
            return badRequest('Unknown plan.')
          }

          case 'trial_unavailable': {
            return badRequest('This plan does not offer a trial.')
          }

          case 'possibly_fraudulent': {
            return conflict(
              'We were not able to start this subscription. Contact customer support for help.'
            )
          }

          case 'already_subscribed': {
            return conflict(
              'You already have an active subscription. Contact customer support for help.'
            )
          }

          case 'customer_gone': {
            return notFound(
              'The customer was not found. Contact customer support for help.'
            )
          }

          case 'delinquent': {
            return conflict(
              'The latest invoice charge has failed. Contact customer support for help.'
            )
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

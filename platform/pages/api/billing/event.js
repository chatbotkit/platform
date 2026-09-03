// @ts-check
import { buf2str } from '@chatbotkit-dev/buffer'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { baseLanguageModel } from '@/config/models'

import prisma from '@/prisma/client'

import { withBilling } from '@/lib/billing.handler'
import { handleWebhookEvent } from '@/lib/billing.provider'
import { log } from '@/lib/debug'
import { captureException } from '@/lib/error'
import { KNOWN_ACCOUNT_LIMITS, resetAccountLimits } from '@/lib/limit.core'
import { withAny } from '@/lib/method'
import {
  notifyInvoicePaymentFailed,
  notifyInvoicePaymentSucceeded,
  notifySubscriptionDeleted,
  notifyTrialStart,
  notifyTrialStartDuplicateCardDetected,
} from '@/lib/notify'
import { slidingWindow } from '@/lib/ratelimit'
import { badRequest, genericError, notAuthorized, ok } from '@/lib/response'
import { recordLanguageTokenUsage } from '@/lib/usage.record'
import { deleteUser } from '@/lib/user.delete'

// @note the billing module receives the webhook end to end - signature,
// verification, event interpretation, the account writes - and hands back
// the follow-ups that belong to the platform's own services. This route only
// maps outcomes to responses and executes those follow-ups.

export default withBilling(
  withAny(async (req) => {
    try {
      const payload = buf2str(await req.arrayBuffer())

      const headers =
        req.headers instanceof Headers
          ? Object.fromEntries(req.headers)
          : req.headers

      const result = await handleWebhookEvent(prisma, slidingWindow, {
        payload,
        headers,
      })

      log(`received billing event`, { result })

      switch (result.outcome) {
        case 'missing_signature': {
          return badRequest()
        }

        case 'unconfigured': {
          return notAuthorized('The billing webhook is not configured')
        }

        case 'invalid': {
          return notAuthorized(result.message)
        }

        case 'unknown_account': {
          return genericError(
            new Error(
              `User with billingCustomerId ${result.customerId} not found`
            )
          )
        }

        case 'handled': {
          const user = /** @type {any} */ (result.account)

          for (const followUp of result.followUps) {
            switch (followUp.action) {
              case 'notify_trial_start': {
                try {
                  await notifyTrialStart(user)
                } catch (e) {
                  await captureException(e)
                }

                break
              }

              case 'notify_trial_duplicate_card': {
                try {
                  await notifyTrialStartDuplicateCardDetected(user)
                } catch (e) {
                  await captureException(e)
                }

                break
              }

              case 'reset_account_limits': {
                try {
                  await resetAccountLimits(user, KNOWN_ACCOUNT_LIMITS)
                } catch (e) {
                  await captureException(e)
                }

                break
              }

              case 'notify_subscription_deleted': {
                try {
                  await notifySubscriptionDeleted(user)
                } catch (e) {
                  await captureException(e)
                }

                break
              }

              case 'notify_invoice_payment_succeeded': {
                try {
                  await notifyInvoicePaymentSucceeded(user)
                } catch (e) {
                  await captureException(e)
                }

                break
              }

              case 'notify_invoice_payment_failed': {
                try {
                  await notifyInvoicePaymentFailed(user)
                } catch (e) {
                  await captureException(e)
                }

                break
              }

              case 'credit_booster_tokens': {
                // @note we use this function because it supports negative
                // values
                await recordLanguageTokenUsage({
                  user: { id: followUp.userId },
                  count: -1000000,
                  model: baseLanguageModel,
                })

                break
              }

              case 'delete_account': {
                await deleteUser(user.id)

                break
              }

              default: {
                return assertUnreachable(followUp)
              }
            }
          }

          return ok({ messages: result.messages })
        }

        default: {
          return assertUnreachable(result)
        }
      }
    } catch (e) {
      return genericError(e)
    }
  })
)

export const config = {
  api: {
    bodyParser: false, // @note don't parse body of incoming requests because we need it raw to verify signature
  },
}

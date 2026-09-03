// @ts-check
import {
  isSellable,
  subscriptionsConfig as subscriptions,
} from '@/lib/billing.core'
import { withGet } from '@/lib/method'
import { ok } from '@/lib/response'

// @todo needs more work and standardization

export default withGet(async function (_req) {
  // @note a deployment that sells nothing has no subscriptions to describe -
  // serve the same empty shape the limit catalogue serves, not a pricing table
  if (!isSellable) {
    return ok({})
  }

  return ok(subscriptions)
})

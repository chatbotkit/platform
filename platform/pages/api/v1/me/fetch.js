// @ts-check
import { hasPlans } from '@/config/limits'

import { withGet } from '@/lib/method'
import { ok } from '@/lib/response'
import { withSession } from '@/lib/session.handler'
import { revealUserPlan } from '@/lib/user.plan'

// @note this endpoint is required in v1 to provide means for the user to check
// if they are logged in correctly

export default withGet(
  withSession(async function (_req, session) {
    const { name, email } = session.user

    // @note a planless deployment has no plan name to report - the nominal
    // internal plan must not leak into the API surface
    if (!hasPlans) {
      return ok({ name, email })
    }

    const { plan } = await revealUserPlan(session.user)

    return ok({ name, email, plan })
  })
)

// @note this is an internal method that is not subject to manual documentation

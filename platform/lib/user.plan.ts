import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import { PLAN_FREE } from '@/config/limits'

import { userToPlan } from '@/lib/billing.core'
import { swrCache } from '@/lib/cache'
import { assert, createSpan } from '@/lib/debug'
import { fastGetUserById } from '@/lib/user.get'

// @note plan resolution itself lives in the billing module's subscription
// model, surfaced through `@/lib/billing.core` - what remains here is the
// platform's shell around it: caching and the child-inheritance walk.

export interface RevealUserPlanInput {
  id: string
  email: string
  parentId?: string | null
}

export interface RevealUserPlanResult {
  plan: string
  effectiveUser: RevealUserPlanInput
}

/**
 * Unlike userToPlan, this function will return the plan that the user is
 * inheriting from their parent as well.
 */
export async function revealUserPlan(
  user: RevealUserPlanInput
): Promise<RevealUserPlanResult> {
  const span = createSpan({ name: 'revealUserPlan' })

  try {
    assert(user.id, 'missing user id')

    return await swrCache(
      `reveal-user-plan:${user.id}`,
      ONE_HOUR_IN_SECONDS,
      async () => {
        // @note a child account never holds a subscription of its own: its
        // parent does, so resolution hops to the parent row. `parentId` is
        // structural and sessions carry it, so a caller-provided one hops
        // directly; the billing facts are another matter - no caller-held
        // shape is trusted to carry them, and resolving a plan always reads
        // the account row.

        let row: Awaited<ReturnType<typeof fastGetUserById>> = null

        let parentId = user.parentId

        if (!parentId) {
          row = await fastGetUserById(user.id)

          parentId = row?.parentId
        }

        if (parentId) {
          const parentUser = await fastGetUserById(parentId)

          if (!parentUser) {
            return { plan: PLAN_FREE, effectiveUser: row ?? user }
          }

          return { plan: userToPlan(parentUser), effectiveUser: parentUser }
        }

        const resolved = row ?? user

        return { plan: userToPlan(resolved), effectiveUser: resolved }
      }
    )
  } finally {
    span.finish()
  }
}

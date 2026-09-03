import type {
  SubscriptionFacts,
  SubscriptionModel,
} from '@chatbotkit-dev/billing-spec'

export type { SubscriptionHolder } from '@chatbotkit-dev/billing-spec'

/**
 * Builds the subscription model for one deployment's facts. With nothing
 * sold, an account's plan comes from its grant alone.
 */
export function createSubscriptionModel(
  facts: SubscriptionFacts
): SubscriptionModel {
  const { structuralPlans, planKeys, grantedPlan } = facts

  // @note `free` and `trial` are not tiers - they are the no-subscription
  // and trialing states - so they are never grantable. The structural
  // unlimited plan is implicitly part of every deployment.
  const planNames: ReadonlySet<string> = new Set(
    [...planKeys, structuralPlans.unlimited].filter(
      (plan) => plan !== structuralPlans.free && plan !== structuralPlans.trial
    )
  )

  return Object.freeze({
    recordedPlanName() {
      return undefined
    },

    hasSubscription(user) {
      return grantedPlan(user.email) !== undefined
    },

    hasTrialed() {
      return false
    },

    userToPlan(user) {
      const granted = grantedPlan(user.email)

      if (granted && planNames.has(granted)) {
        return granted
      }

      return structuralPlans.free
    },
  } satisfies SubscriptionModel)
}

import type { Subscriptions, TrialPolicy } from '@chatbotkit-dev/billing-spec'

import { subscriptionsConfig } from './config'

/**
 * Derives the trial policy from a subscriptions configuration.
 */
export function createTrialPolicy(
  subscriptions: Pick<Subscriptions, 'trialPlans'>
): TrialPolicy {
  const trialPlans: readonly string[] = Object.freeze([
    ...(subscriptions.trialPlans ?? []),
  ])

  return Object.freeze({
    trialPlans,

    primaryTrialPlan: trialPlans[0],

    canTrialPlan(plan: string): boolean {
      return trialPlans.includes(plan)
    },
  })
}

export const { trialPlans, primaryTrialPlan, canTrialPlan } =
  createTrialPolicy(subscriptionsConfig)

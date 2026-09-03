import type { Subscriptions } from '@chatbotkit-dev/billing-spec'

// @note nothing is sold and there is nothing to configure - no pricing
// surface, no upgrade affordance, no trials.

export const isConfigured = false

export const subscriptionsConfig: Subscriptions = Object.freeze({
  trialDays: 0,

  trialPlans: [],

  pricing: {},
})


import {
  createBillingGates,
  createSubscriptionModel,
} from '@chatbotkit-dev/billing'

import {
  PLAN_FREE,
  PLAN_KEYS,
  PLAN_TRIAL,
  PLAN_UNLIMITED,
  hasPlans,
} from '@/config/limits'

import { grantedPlan, isChildUser } from '@/lib/user.type'

export {
  primaryTrialPlan,
  subscriptionsConfig,
  trialPlans,
} from '@chatbotkit-dev/billing'

const model = createSubscriptionModel({
  structuralPlans: {
    free: PLAN_FREE,
    trial: PLAN_TRIAL,
    unlimited: PLAN_UNLIMITED,
  },

  planKeys: PLAN_KEYS,

  grantedPlan,
})

export const {
  recordedPlanName, // @todo must be only available on chatbotkit-internal/billing as it is an internal thing

  hasSubscription,
  hasTrialed,

  userToPlan,
} = model

export const { isSellable, isBillingConfigured, canDoBilling } =
  createBillingGates({
    hasPlans,
    isChildUser,
  })

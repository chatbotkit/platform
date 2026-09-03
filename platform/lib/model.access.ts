import limits, { hasPlans } from '@/config/limits'

import { parseAndRevealLanguageModel } from '@/lib/model.utils'
import type { RevealUserPlanInput } from '@/lib/user.plan'
import { revealUserPlan } from '@/lib/user.plan'

/**
 * The method checks if the user can use premium models (pricing tokenRatio
 * above 1).
 *
 * @note a plan entitlement, resolved through the plan catalogue
 * (`models.advanced`) - and freely available in the planless deployment,
 * which has no entitlements to refuse on.
 */
export async function canUseModel(
  user: RevealUserPlanInput,
  model: string
): Promise<boolean> {
  if (!hasPlans) {
    return true
  }

  const { config } = parseAndRevealLanguageModel(model)

  if (config.pricing.tokenRatio <= 1) {
    return true
  }

  const { plan } = await revealUserPlan(user)

  return limits[plan]?.models?.advanced === true
}

/**
 * The method checks if the user can use custom models.
 *
 * @note the same catalogue entitlement shape (`models.custom`); every plan
 * currently grants it, so the gate exists in data rather than as a hardcoded
 * `return true`.
 */
export async function canUseCustomModel(user: RevealUserPlanInput): Promise<boolean> {
  if (!hasPlans) {
    return true
  }

  const { plan } = await revealUserPlan(user)

  return limits[plan]?.models?.custom === true
}

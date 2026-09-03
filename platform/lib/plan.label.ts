import { PLAN_FREE, PLAN_TRIAL, PLAN_UNLIMITED } from '@/config/limits'

const structuralPlanLabels: Record<string, string> = {
  [PLAN_FREE]: 'Free',
  [PLAN_TRIAL]: 'Trial',
  [PLAN_UNLIMITED]: 'Unlimited',
}

/**
 * Format a plan name for display. The structural plans carry a fixed label;
 * any other plan is titled from its own key - `proPlus` reads as `Pro Plus`,
 * `enterprise_plus` as `Enterprise Plus`.
 */
export function formatPlanLabel(plan: string): string {
  if (!plan) {
    return ''
  }

  if (structuralPlanLabels[plan]) {
    return structuralPlanLabels[plan]
  }

  return plan
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

import type {
  BillingGates,
  BillingGatesFacts,
} from '@chatbotkit-dev/billing-spec'

/**
 * Builds the billing gates for one deployment's facts. With nothing sold and
 * no payment provider, every gate is closed.
 */
export function createBillingGates(_facts: BillingGatesFacts): BillingGates {
  return Object.freeze({
    isSellable: false,

    isBillingConfigured(): boolean {
      return false
    },

    canDoBilling(_user: unknown): boolean {
      return false
    },
  })
}

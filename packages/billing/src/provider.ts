// @note the payment-provider operations, exposed at
// `@chatbotkit-dev/billing/provider`. This default module has no payment
// provider, so every operation refuses.
//
// @note this subpath is not part of @chatbotkit-dev/billing-spec: the
// platform's billing routes import these operations and their result shapes
// directly, which couples them to whichever implementation is installed. The
// shapes below mirror that de-facto contract so the routes compile - a
// deployment that sells must override @chatbotkit-dev/billing with an
// implementation providing the same operations.

/** The account shape the customer operations read. */
export interface BillingAccount {
  billingCustomerId?: string | null

  billingSubscriptionId?: string | null
}

export interface CustomerAccount extends BillingAccount {
  id: string

  email?: string | null

  name?: string | null
}

function unsupported(): never {
  throw new Error(
    'no payment provider is installed, so billing operations cannot run - ' +
      'override @chatbotkit-dev/billing with a package that satisfies ' +
      '@chatbotkit-dev/billing-spec and provides these operations'
  )
}

/**
 * Retrieves one price from the provider - the probe the boot-time assertions
 * check the selling configuration against.
 */
export async function retrievePrice(_priceId: string): Promise<unknown> {
  return unsupported()
}

export type OpenBillingPortalResult =
  | { outcome: 'redirect'; url: string }
  | { outcome: 'failed' }

export async function openBillingPortal(
  _db: unknown,
  _account: CustomerAccount,
  _options: { returnUrl: string }
): Promise<OpenBillingPortalResult> {
  return unsupported()
}

export type StartCheckoutResult =
  | { outcome: 'redirect'; url: string }
  | { outcome: 'unknown_plan' }
  | { outcome: 'trial_unavailable' }
  | { outcome: 'possibly_fraudulent' }
  | { outcome: 'already_subscribed' }
  | { outcome: 'customer_gone' }
  | { outcome: 'delinquent' }
  | { outcome: 'failed' }

export interface CheckoutIntent {
  plan: string

  trial: boolean

  coupon?: string | null

  referral?: string | null

  returnUrl: string
}

export async function startCheckout(
  _db: unknown,
  _account: CustomerAccount,
  _intent: CheckoutIntent
): Promise<StartCheckoutResult> {
  return unsupported()
}

export type SkipTrialResult =
  | { outcome: 'skipped'; subscriptionId: string }
  | { outcome: 'not_trialing' }
  | { outcome: 'no_subscription' }

export async function skipTrial(
  _db: unknown,
  _account: BillingAccount & {
    id: string
    billingSubscriptionStatus?: string | null
  }
): Promise<SkipTrialResult> {
  return unsupported()
}

export async function deleteCustomer(
  _account: Pick<BillingAccount, 'billingCustomerId'>
): Promise<boolean> {
  return unsupported()
}

export type WebhookFollowUp =
  | { action: 'notify_trial_start' }
  | { action: 'notify_trial_duplicate_card' }
  | { action: 'reset_account_limits' }
  | { action: 'notify_subscription_deleted' }
  | { action: 'notify_invoice_payment_succeeded' }
  | { action: 'notify_invoice_payment_failed' }
  | { action: 'credit_booster_tokens'; userId: string }
  | { action: 'delete_account' }

export type HandleWebhookEventResult =
  | { outcome: 'missing_signature' }
  | { outcome: 'unconfigured' }
  | { outcome: 'invalid'; message: string }
  | { outcome: 'unknown_account'; customerId: string }
  | {
      outcome: 'handled'
      type: string
      account?: { id?: string } | null
      followUps: WebhookFollowUp[]
      messages: string[]
    }

export async function handleWebhookEvent(
  _db: unknown,
  _slidingWindow: unknown,
  _request: { payload: string; headers: Record<string, unknown> }
): Promise<HandleWebhookEventResult> {
  return unsupported()
}

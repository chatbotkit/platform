// @note the billing module contract: the surface a billing module exposes,
// as function and value shapes an implementation conforms to. How an
// implementation configures itself - environment variables, configuration
// formats, payment provider - is its own business and deliberately absent
// here. The default implementation lives in @chatbotkit-dev/billing.

/**
 * The classic surface most call sites read: trial policy plus a plan-to-price
 * table. A null/absent price presents as Infinity, matching how the unbounded
 * tier has always rendered.
 */
export interface Subscriptions {
  trialDays: number

  trialPlans?: string[]

  pricing: Record<string, number>
}

/**
 * The platform facts the subscription model closes over: its plan
 * vocabulary, its installed catalogue and its grant mechanism. Nothing else
 * crosses the boundary.
 */
export interface SubscriptionFacts {
  /**
   * The structural plan names: `free` is the plan of an account with no
   * subscription and no grant, `trial` the plan of a trialing subscription,
   * and `unlimited` the implicit full-access plan every deployment has.
   */
  structuralPlans: {
    free: string
    trial: string
    unlimited: string
  }

  /** The plan names of the installed limits catalogue. */
  planKeys: readonly string[]

  /** The plan granted to an email address by a platform override, if any. */
  grantedPlan: (email: string) => string | undefined
}

/**
 * The account shape the subscription checks read.
 *
 * @note the property names are the account schema's billing columns. They
 * are the billing module's own recording (null when the account has none)
 * and an implementation detail everywhere else: the platform transports them
 * on account rows but never interprets them.
 */
export interface SubscriptionHolder {
  email: string

  billingSubscriptionId?: string | null

  billingSubscriptionStatus?: string | null
}

/**
 * The subscription model surface: the sellable catalogue, the id/name
 * mappings and the subscription checks, closed over one deployment's facts.
 */
export interface SubscriptionModel {
  /**
   * The display name of the plan an account is recorded on - undefined for
   * an account with no subscription or one recorded on an id the deployment
   * no longer knows. Tolerant on purpose: it feeds listings and exports.
   */
  recordedPlanName(
    account: Pick<SubscriptionHolder, 'billingSubscriptionId'>
  ): string | undefined

  /** Whether the account holds a live subscription or a grant. */
  hasSubscription(user: SubscriptionHolder): boolean

  /**
   * Whether the account has ever consumed its trial - one per account,
   * regardless of the plan it ran on or how the trial ended.
   */
  hasTrialed(account: {
    billingSubscriptionTrialedAt?: Date | string | null
  }): boolean

  /** The plan the account is on, resolved from its own subscription facts. */
  userToPlan(user: SubscriptionHolder): string
}

/** Builds the subscription model for one deployment's facts. */
export type CreateSubscriptionModel = (
  facts: SubscriptionFacts
) => SubscriptionModel

/**
 * The platform facts the billing gates close over.
 */
export interface BillingGatesFacts {
  /** Whether the platform has an installed plan catalogue. */
  hasPlans: boolean

  /** Whether an account is structurally owned by another account. */
  isChildUser: (user: unknown) => boolean
}

/**
 * The deployment gates: whether this deployment sells at all, and whether a
 * given account may use billing.
 */
export interface BillingGates {
  /**
   * Whether this deployment sells plans at all. False means no pricing
   * surface, no upgrade affordance and no trials.
   */
  isSellable: boolean

  /** Whether a payment provider is configured. Read lazily. */
  isBillingConfigured(): boolean

  /** Whether this account may reach the billing surface at all. */
  canDoBilling(user: unknown): boolean
}

/** Builds the billing gates for one deployment's facts. */
export type CreateBillingGates = (facts: BillingGatesFacts) => BillingGates

/**
 * The trial policy, derived from a subscriptions configuration.
 */
export interface TrialPolicy {
  /**
   * The plans on which a free trial can be started - the single switch for
   * trials, an empty list disabling them everywhere.
   */
  trialPlans: readonly string[]

  /**
   * The plan a trial is presented as by default, undefined when trials are
   * disabled.
   */
  primaryTrialPlan: string | undefined

  canTrialPlan(plan: string): boolean
}

/** Derives the trial policy from a subscriptions configuration. */
export type CreateTrialPolicy = (
  subscriptions: Pick<Subscriptions, 'trialPlans'>
) => TrialPolicy

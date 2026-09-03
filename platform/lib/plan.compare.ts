import { formatPlanLabel } from '@/lib/plan.label'

export interface PlanChange {
  /** the dotted path into the limit table, e.g. `database.files` */
  key: string

  /** the path rendered for a human, e.g. `Database files` */
  label: string

  from: unknown
  to: unknown
}

export interface PlanComparison {
  changes: PlanChange[]

  /** how many further increases were not listed */
  more: number
}

/**
 * Flattens a limit table into dotted leaf paths, preserving the catalogue's
 * own key order - which is platform vocabulary and stable, so the resulting
 * list reads the same way on every deployment.
 */
export function flattenLimits(
  value: unknown,
  prefix = ''
): [string, unknown][] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [[prefix, value]]
  }

  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, entry]) => flattenLimits(entry, prefix ? `${prefix}.${key}` : key)
  )
}

/**
 * Renders a dotted limit path as a phrase. The keys are platform vocabulary,
 * so this is a formatting rule rather than a table of names - the same reason
 * `formatPlanLabel` titles a plan from its own key.
 */
export function formatLimitLabel(key: string): string {
  const words = key
    .split('.')
    .join(' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim()

  return (words.charAt(0).toUpperCase() + words.slice(1)).replace(
    // @note initialisms read wrong in sentence case; a plural keeps its s
    /\b(url|api|ai)(s?)\b/gi,
    (_, initialism, plural) => initialism.toUpperCase() + plural.toLowerCase()
  )
}

/**
 * True when moving from one value to another is an increase worth showing.
 * Only unambiguous improvements qualify: a bigger number, or a capability
 * switched on. Anything else - a decrease, an equal value, a shape the tables
 * disagree about - is left out rather than guessed at.
 */
function isIncrease(from: unknown, to: unknown): boolean {
  if (typeof to === 'number' && typeof from === 'number') {
    return to > from
  }

  if (typeof to === 'boolean' && typeof from === 'boolean') {
    return to && !from
  }

  return false
}

/**
 * What a user gains by moving between two plans.
 *
 * @param fromTable the limit table of the plan they are on, if any
 * @param toTable the limit table of the plan they are considering
 * @param max how many changes to list before summarising the rest
 */
export function comparePlans(
  fromTable: unknown,
  toTable: unknown,
  { max = 6 }: { max?: number } = {}
): PlanComparison {
  if (!fromTable || !toTable) {
    return { changes: [], more: 0 }
  }

  const from = Object.fromEntries(flattenLimits(fromTable))

  const increases = flattenLimits(toTable)
    .filter(([key, to]) => isIncrease(from[key], to))
    .map(([key, to]) => ({
      key,
      label: formatLimitLabel(key),
      from: from[key],
      to,
    }))

  return {
    changes: increases.slice(0, max),
    more: Math.max(0, increases.length - max),
  }
}

/**
 * The plans a deployment can sell to someone on `currentPlan`, cheapest
 * first. Everything here comes from the deployment's own configuration - the
 * platform contributes no plan names of its own.
 *
 * @param pricing the plan-to-price table from the subscriptions configuration
 * @param currentPlan the plan the user is on
 */
export function sellablePlans(
  pricing: Record<string, number>,
  currentPlan?: string
): { plan: string; label: string; price: number }[] {
  return Object.entries(pricing ?? {})
    .filter(([plan, price]) => {
      if (plan === currentPlan) {
        return false
      }

      // @note a zero price is not something to upsell, and an unbounded one is
      // not self-serve - that plan is sold by talking to someone
      return Number.isFinite(price) && price > 0
    })
    .sort(([, a], [, b]) => a - b)
    .map(([plan, price]) => ({ plan, label: formatPlanLabel(plan), price }))
}

export interface PlanRung {
  plan: string
  label: string
  price: number

  /** the plan the user is on right now */
  current: boolean

  /** a finite non-zero price - checkout can sell it without a conversation */
  selfServe: boolean
}

/**
 * The whole ladder the pricing surface renders, cheapest first: every
 * self-serve plan, any unbounded plan (sold by talking to someone), and the
 * user's own plan even where it is not for sale - the rung they stand on is
 * what gives the rest of the ladder its scale.
 *
 * @param pricing the plan-to-price table from the subscriptions configuration
 * @param currentPlan the plan the user is on
 */
export function planLadder(
  pricing: Record<string, number>,
  currentPlan?: string
): PlanRung[] {
  return Object.entries(pricing ?? {})
    .filter(([plan, price]) => {
      if (plan === currentPlan) {
        return true
      }

      // @note a zero price is not something to upsell
      return price > 0
    })
    .sort(([, a], [, b]) => a - b)
    .map(([plan, price]) => ({
      plan,
      label: formatPlanLabel(plan),
      price,
      current: plan === currentPlan,
      selfServe: Number.isFinite(price) && price > 0,
    }))
}

// @note which limits headline a plan card, in display order. The keys are
// platform vocabulary - every one names a platform feature - so listing them
// here is a rendering choice, not a claim about any deployment's business:
// a catalogue that does not carry a key simply does not headline it.
const headlineLimits: [key: string, label: string][] = [
  ['tokens', 'credit tokens per month'],
  ['messages', 'messages'],
  ['conversations', 'conversations'],
  ['database.bots', 'bots'],
  ['database.datasets', 'datasets'],
  ['database.skillsets', 'skillsets'],
  ['database.files', 'files'],
  ['database.integrations', 'integrations'],
  ['models.advanced', 'Premium language models'],
  ['models.custom', 'Bring your own model'],
]

export interface PlanEntitlement {
  key: string
  label: string
  value: unknown
}

/**
 * The headline entitlements of a plan - the absolute values a card leads
 * with, as opposed to the full table the comparison matrix renders. A
 * capability the plan does not grant is left off rather than advertised as
 * missing.
 */
export function headlineEntitlements(
  table: unknown,
  { max = 7 }: { max?: number } = {}
): PlanEntitlement[] {
  if (!table) {
    return []
  }

  const flat = Object.fromEntries(flattenLimits(table))

  return headlineLimits
    .filter(([key]) => flat[key] !== undefined && flat[key] !== false)
    .map(([key, label]) => ({ key, label, value: flat[key] }))
    .slice(0, max)
}

export interface LimitRow {
  key: string
  label: string

  /** the section the row renders under; empty for top-level scalars */
  section: string

  /** one value per table, in the order the tables were given */
  values: unknown[]
}

/**
 * The full comparison matrix: one row per limit, one value column per plan.
 * Keys appear in first-seen catalogue order across all tables, so plans that
 * disagree about shape still land in one coherent table - a key a plan does
 * not carry yields `undefined` in its column.
 */
export function limitMatrix(tables: unknown[]): LimitRow[] {
  const order: string[] = []
  const seen = new Set<string>()

  const flats = tables.map((table) =>
    Object.fromEntries(flattenLimits(table ?? {}))
  )

  for (const flat of flats) {
    for (const key of Object.keys(flat)) {
      if (key && !seen.has(key)) {
        seen.add(key)

        order.push(key)
      }
    }
  }

  return order.map((key) => {
    const dot = key.indexOf('.')

    return {
      key,
      label: formatLimitLabel(dot === -1 ? key : key.slice(dot + 1)),
      section: dot === -1 ? '' : formatLimitLabel(key.slice(0, dot)),
      values: flats.map((flat) => flat[key]),
    }
  })
}

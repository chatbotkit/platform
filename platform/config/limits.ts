// @note the plan catalogue: one full limit table per plan name. The former
// @chatbotkit-dev/config-limits package and its spec were folded in here.
//
// The catalogue is deployment configuration, not code: it is read from the
// LIMITS_CONFIG environment variable as JSON. Without it there is no plan
// concept at all - the planless deployment - and that is a working
// configuration: every plan lookup resolves to the unlimited table below,
// while enumeration stays empty so nothing renders or serves invented plan
// names. It is deliberately NOT "everyone on the lowest plan".
//
// LIMITS_CONFIG shape - an object keyed by plan name, each value a COMPLETE
// limit table (the schema is strict: a missing or misspelled key fails the
// boot rather than silently resolving to 0):
//
//     { "pro": { "tokens": 3000000, "conversations": 2500, ... }, ... }
//
// The limit shape is platform vocabulary - every key names a platform feature
// (bots, datasets, tokens, shell memory). The plan names are deployment
// vocabulary - they describe one deployment's business model.
//
// The unlimited table is unlimited only where a value grants an entitlement.
// Values that size a real allocation (shell and sitemap memory, run times,
// retention windows fed into date arithmetic) stay at the most generous
// finite sizes, because Infinity there is not "no limit", it is a broken
// sandbox or an invalid date.
import { z } from 'zod'

export type SitemapEngine = 'cheerio' | 'puppeteer'

export interface LimitType {
  tokens: number

  conversations: number
  messages: number

  image: number

  video: number

  audio: number

  fetch: number

  email: number

  rate: {
    polls: number
    records: number
    abilities: number
    conversations: number
    messages: number
  }

  database: {
    bots: number
    datasets: number
    records: number
    skillsets: number
    abilities: number
    files: number
    users: number
    portals: number
    policies: number
    teams: number
    teamMembers: number
    integrations: number
  }

  models: {
    /** Whether the plan may use premium models (pricing tokenRatio > 1). */
    advanced: boolean
    /** Whether the plan may bring its own custom model. */
    custom: boolean
  }

  file: {
    maxFileSize: number
  }

  attachment: {
    maxFileSize: number
  }

  shell: {
    // in MB
    memory: number
    // in MB
    disk: number
  }

  sitemapIntegration: {
    maxUrls: number
    maxTime: number // in minutes
    engines: SitemapEngine[]
    memory: {
      cheerio: number
      puppeteer: number
    }
  }

  notionIntegration: {
    maxPages: number
    maxTime: number // in minutes
  }

  widgetIntegration: {
    canDisablePoweredBy: boolean
  }

  audit: {
    retentionDays: number
    exportEnabled: boolean
  }

  eventLogs: {
    retentionDays: number
    exportEnabled: boolean
    liveStreaming: boolean
  }

  /**
   * Recurring background work the plan may run: scheduled integration syncs
   * and triggers, and scheduled tasks. The queue workers turn a schedule off
   * when the account's plan does not grant it, so this gates the recurring
   * run rather than the one-off manual one.
   */
  scheduling: {
    integrations: boolean
    tasks: boolean
  }

  /**
   * Whether the plan has somewhere to upgrade to - drives the dashboard's
   * upgrade affordance. The top of the ladder (and anything sold outside
   * self-serve) sets it false.
   */
  upgradable: boolean
}

// @note plan names are deployment data (the keys of LIMITS_CONFIG), not a
// union the code defines. The two constants below are the only names the
// platform itself gives meaning to, and they are structural states rather
// than tiers: `free` is the plan of an account with no subscription and no
// grant, `trial` is the plan of a trialing subscription regardless of what
// it is billed on. Everything that needs these names imports them from here -
// the single point of reference - rather than spelling the strings.
export const PLAN_FREE = 'free'
export const PLAN_TRIAL = 'trial'

// @note the third structural name: the plan that resolves to the unlimited
// table in every deployment. It is implicitly present - resolvable by lookup,
// grantable as a comp, usable as a manual subscription shorthand - but never
// enumerated, so no catalogue listing, pricing surface or API response
// renders it. The built-in `platform` account resolves to it.
export const PLAN_UNLIMITED = 'unlimited'

export type Limits = Record<string, LimitType>

// --- validation -------------------------------------------------------------

/**
 * The full limit shape, mirroring `LimitType`. `.strict()` everywhere means an
 * unknown key is a hard error, not a dropped value. The overrides section
 * below derives its partial schema from this one, and the compile-time guards
 * in `tests/config/limits.utest.ts` keep it complete against `LimitType`.
 */
export const fullLimitSchema = z
  .object({
    tokens: z.number(),

    conversations: z.number(),
    messages: z.number(),

    image: z.number(),
    video: z.number(),
    audio: z.number(),

    fetch: z.number(),

    email: z.number(),

    rate: z
      .object({
        polls: z.number(),
        records: z.number(),
        abilities: z.number(),
        conversations: z.number(),
        messages: z.number(),
      })
      .strict(),

    database: z
      .object({
        bots: z.number(),
        datasets: z.number(),
        records: z.number(),
        skillsets: z.number(),
        abilities: z.number(),
        files: z.number(),
        users: z.number(),
        portals: z.number(),
        policies: z.number(),
        teams: z.number(),
        teamMembers: z.number(),
        integrations: z.number(),
      })
      .strict(),

    models: z.object({ advanced: z.boolean(), custom: z.boolean() }).strict(),

    file: z.object({ maxFileSize: z.number() }).strict(),

    attachment: z.object({ maxFileSize: z.number() }).strict(),

    shell: z.object({ memory: z.number(), disk: z.number() }).strict(),

    sitemapIntegration: z
      .object({
        maxUrls: z.number(),
        maxTime: z.number(),
        engines: z.array(z.enum(['cheerio', 'puppeteer'])),
        memory: z
          .object({ cheerio: z.number(), puppeteer: z.number() })
          .strict(),
      })
      .strict(),

    notionIntegration: z
      .object({ maxPages: z.number(), maxTime: z.number() })
      .strict(),

    widgetIntegration: z.object({ canDisablePoweredBy: z.boolean() }).strict(),

    audit: z
      .object({ retentionDays: z.number(), exportEnabled: z.boolean() })
      .strict(),

    eventLogs: z
      .object({
        retentionDays: z.number(),
        exportEnabled: z.boolean(),
        liveStreaming: z.boolean(),
      })
      .strict(),

    scheduling: z
      .object({ integrations: z.boolean(), tasks: z.boolean() })
      .strict(),

    upgradable: z.boolean(),
  })
  .strict()

const limitsSchema = z
  .record(z.string().min(1), fullLimitSchema)
  .refine((catalogue) => !(PLAN_UNLIMITED in catalogue), {
    message: `"${PLAN_UNLIMITED}" is a reserved structural plan name - every deployment already has it, and it always resolves to the unlimited table`,
  })

// @note a malformed LIMITS_CONFIG fails loudly on purpose - a catalogue that
// silently resolved to planless would hand every account unlimited use
const limitsConfig = limitsSchema.parse(
  process.env.LIMITS_CONFIG ? JSON.parse(process.env.LIMITS_CONFIG) : {}
)

/**
 * Whether the installed catalogue names any plans. False means the planless
 * deployment: no plan may be shown, and no request may be refused on
 * entitlement grounds.
 */
export const hasPlans = Object.keys(limitsConfig).length > 0

const unlimitedLimits: LimitType = {
  tokens: Infinity,

  conversations: Infinity,
  messages: Infinity,

  image: Infinity,
  video: Infinity,
  audio: Infinity,

  fetch: Infinity,

  email: Infinity,

  rate: {
    polls: Infinity,
    records: Infinity,
    abilities: Infinity,
    conversations: Infinity,
    messages: Infinity,
  },

  database: {
    bots: Infinity,
    datasets: Infinity,
    records: Infinity,
    skillsets: Infinity,
    abilities: Infinity,
    files: Infinity,
    users: Infinity,
    portals: Infinity,
    policies: Infinity,
    teams: Infinity,
    teamMembers: Infinity,
    integrations: Infinity,
  },

  models: {
    advanced: true,
    custom: true,
  },

  file: {
    maxFileSize: Infinity,
  },

  attachment: {
    maxFileSize: Infinity,
  },

  // @note allocation sizes, not entitlements - see the header
  shell: {
    memory: 4_096,
    disk: 8_192,
  },

  sitemapIntegration: {
    maxUrls: Infinity,
    maxTime: 60, // in minutes - feeds a deadline timer
    engines: ['cheerio', 'puppeteer'],
    memory: {
      cheerio: 1_024,
      puppeteer: 4_096,
    },
  },

  notionIntegration: {
    maxPages: Infinity,
    maxTime: 60, // in minutes - feeds a deadline timer
  },

  widgetIntegration: {
    canDisablePoweredBy: true,
  },

  audit: {
    retentionDays: 365, // feeds date arithmetic
    exportEnabled: true,
  },

  eventLogs: {
    retentionDays: 365, // feeds date arithmetic
    exportEnabled: true,
    liveStreaming: true,
  },

  scheduling: {
    integrations: true,
    tasks: true,
  },

  // @note nothing to upgrade to when there is no plan concept
  upgradable: false,
}

// @note with a catalogue installed, the unlimited plan is resolvable but not
// enumerable: the get/has traps answer for it, while ownKeys stays the
// catalogue's, so listings and JSON never carry it (Infinity does not
// survive JSON anyway).
const limits: Limits = hasPlans
  ? (new Proxy(limitsConfig as Limits, {
      get(target, prop) {
        return prop === PLAN_UNLIMITED
          ? unlimitedLimits
          : target[prop as string]
      },

      has(target, prop) {
        return prop === PLAN_UNLIMITED || prop in target
      },
    }) as Limits)
  : (new Proxy(
      {},
      {
        get(_target, prop) {
          return typeof prop === 'string' ? unlimitedLimits : undefined
        },
      }
    ) as Limits)

export default limits

// --- overrides --------------------------------------------------------------
//
// Per-account exceptions: plan grants and limit overrides. The former
// @chatbotkit-dev/config-overrides package and its spec were folded in here.
//
// An override raises (or lowers) what one account may do, outside whatever its
// plan allows. It exists because plans change and customers do not: when a
// tier is repriced, the accounts already on it are grandfathered here rather
// than by editing the tier. A `plan` on an entry is a grant - it puts the
// account on that plan without it being paid for.
//
// The overrides are deployment configuration, not code: they are read from the
// OVERRIDES_CONFIG environment variable as JSON. Without it there are no
// exceptions at all - the right default for every deployment. Attribution -
// which customer an account id belongs to - lives as comments beside the
// value in the encrypted environment file, because an exception nobody can
// attribute is one nobody can ever remove.
//
// OVERRIDES_CONFIG shape - an object whose key convention depends on the field:
//
//     {
//       "ops@example.com": { "plan": "enterprise" },
//       "clxyz0000000000000000000n": {
//         "limits": { "database": { "files": 300 } },
//         "plans": { "premium": { "limits": { "tokens": 5000000 } } }
//       }
//     }
//
// - plan - a grant, read against the account's email address: "treat this
//   account as if it bought that plan". No subscription, no billing - the
//   account simply gets everything the plan gets. This is the comp mechanism
//   for teammates, friendly customers and integration accounts.
// - vip - an account-id keyed marker (hub publishing skips the review queue).
// - limits - an account-id keyed tweak: whatever plan the account is on (paid
//   or granted), bend these specific values for it. Applied unconditionally,
//   regardless of the user's current plan. A few account-summary helpers fall
//   back to email, but enforcement paths resolve this by id, so operators must
//   not depend on email-keyed limits.
// - plans[plan].limits - the same tweak, but only while on that plan, taking
//   precedence over the unconditional limits, so a grandfathered exception
//   does not leak into a different (e.g. downgraded) plan. Unlike a grant,
//   this may name `free` and `trial` - tweaking the limits of an account
//   while it is free or trialing is perfectly meaningful.
//
// An id key follows the account, while the address key used for a plan grant
// follows whoever holds it. A key that matches nothing is silently an override
// that never applies.

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer U)[]
    ? U[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

/**
 * The limits an override carries: any subset of the limit table, at any
 * depth - `{ database: { files: 300 } }` overrides one value and leaves the
 * rest of `database` to the plan.
 */
export type OverrideLimits = DeepPartial<LimitType>

export interface OverrideEntry {
  plan?: string

  /**
   * Marks the account as a VIP - hub publishing skips the review queue for
   * these accounts. Keyed by account id in practice: VIP is a claim about an
   * account, not about whoever holds an address.
   */
  vip?: boolean

  limits?: OverrideLimits
  plans?: Partial<Record<string, { limits: OverrideLimits }>>
}

/** Override entries. Each consumer defines whether it resolves an id or email. */
export type Overrides = Record<string, OverrideEntry>

// A strict, machine-checkable description of what an entry may contain. The
// point is to turn a mis-nested or typo'd override into a loud boot failure
// instead of a silently-ignored no-op - which is how two live overrides once
// ended up doing nothing: their limits were nested one level too shallow, so
// `resolveOverrideLimits` never saw them. The compile-time guards in
// `tests/config/limits.utest.ts` keep these schemas complete against
// `LimitType`; plan names are plain strings, keyed by the deployment's
// catalogue.

// An override carries only *some* limits, so every property becomes optional
// while `.strict()` is kept - `{ database: { files: 300 } }` is valid, but a
// stray or typo'd key still is not.
function deepPartialStrict(
  schema: z.ZodObject<z.ZodRawShape>
): z.ZodObject<z.ZodRawShape> {
  const shape = schema.shape

  const next: z.ZodRawShape = {}

  for (const key of Object.keys(shape)) {
    const field = shape[key] as z.ZodTypeAny

    next[key] =
      field instanceof z.ZodObject
        ? deepPartialStrict(field).optional()
        : field.optional()
  }

  return z.object(next).strict()
}

export const partialLimitSchema = deepPartialStrict(fullLimitSchema)

// @note plan names are deployment data: the valid keys are exactly the
// deployment's catalogue (LIMITS_CONFIG), so an override naming a plan the
// deployment does not have fails the boot instead of silently never applying.
// In the planless deployment there are no valid plan keys at all.
export const PLAN_KEYS: readonly string[] = Object.freeze(
  hasPlans ? Object.keys(limits) : []
)

// The plans a grant can name: the catalogue minus `free` and `trial`,
// because a grant of either can never do what its author intended.
// "Pretend they bought free" describes every account that bought nothing -
// it changes nothing. "Pretend they bought trial" is incoherent: trial is
// not a plan anyone is put on, it is the temporary state of a real
// subscription in the billing provider's `trialing` status, so a granted trial would hand
// out trial entitlements forever with no trial that ever ends. Rejecting
// both at boot turns a silently-dead (or silently-wrong) entry into a
// deploy-time error, the same way an unknown plan name is one.
export const GRANTABLE_PLAN_KEYS: readonly string[] = Object.freeze([
  ...PLAN_KEYS.filter((plan) => plan !== PLAN_FREE && plan !== PLAN_TRIAL),

  // @note the structural unlimited plan is always grantable - "full access"
  // is the most common comp of all, and it exists in every deployment
  PLAN_UNLIMITED,
])

/**
 * Builds the override schemas for a given set of plan keys. The deployment's
 * schemas below bind the installed catalogue; the factory exists so the test
 * suite can pin the validation behaviour against a fixture catalogue without
 * depending on the environment.
 */
export function createOverrideSchemas(planKeys: readonly string[]) {
  const grantable = [
    ...planKeys.filter((plan) => plan !== PLAN_FREE && plan !== PLAN_TRIAL),
    PLAN_UNLIMITED,
  ]

  const overrideEntrySchema = z
    .object({
      plan: z
        .string()
        .refine((plan) => grantable.includes(plan), {
          message: 'not a grantable plan of this deployment',
        })
        .optional(),
      vip: z.boolean().optional(),
      limits: partialLimitSchema.optional(),
      plans: z
        .object(
          Object.fromEntries(
            planKeys.map((plan) => [
              plan,
              z.object({ limits: partialLimitSchema }).strict().optional(),
            ])
          )
        )
        .strict()
        .optional(),
    })
    .strict()

  const overridesSchema = z.record(z.string().min(1), overrideEntrySchema)

  return { overrideEntrySchema, overridesSchema }
}

export const { overrideEntrySchema, overridesSchema } =
  createOverrideSchemas(PLAN_KEYS)

// @note a malformed OVERRIDES_CONFIG fails loudly on purpose - see the section
// header above
export const overrides: Overrides = overridesSchema.parse(
  process.env.OVERRIDES_CONFIG ? JSON.parse(process.env.OVERRIDES_CONFIG) : {}
) as Overrides

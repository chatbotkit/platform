/**
 * @jest-environment node
 */
import type { LimitType, Limits, fullLimitSchema } from '@/config/limits'
import {
  PLAN_KEYS,
  createOverrideSchemas,
  overrideEntrySchema,
  overrides,
  overridesSchema,
} from '@/config/limits'

import type { z } from 'zod'

// --- the limits seam --------------------------------------------------------
//
// @note the planless branch has no coverage anywhere else in this repository:
// the hosted environment always carries LIMITS_CONFIG, so `hasPlans` is true
// in every other suite. A community install without it is exactly the
// opposite, and these tests pin down what it gets.

/** A complete limit table - the schema is strict, so nothing may be omitted. */
function fullTable() {
  return {
    tokens: 1,

    conversations: 1,
    messages: 1,

    image: 1,
    video: 1,
    audio: 1,

    fetch: 1,

    email: 1,

    rate: {
      polls: 1,
      records: 1,
      abilities: 1,
      conversations: 1,
      messages: 1,
    },

    database: {
      bots: 1,
      datasets: 1,
      records: 1,
      skillsets: 1,
      abilities: 1,
      files: 1,
      users: 1,
      portals: 1,
      policies: 1,
      teams: 1,
      teamMembers: 1,
      integrations: 1,
    },

    file: { maxFileSize: 1 },

    attachment: { maxFileSize: 1 },

    shell: { memory: 1, disk: 1 },

    sitemapIntegration: {
      maxUrls: 1,
      maxTime: 1,
      engines: ['cheerio'],
      memory: { cheerio: 1, puppeteer: 1 },
    },

    notionIntegration: { maxPages: 1, maxTime: 1 },

    widgetIntegration: { canDisablePoweredBy: true },

    models: { advanced: true, custom: true },

    upgradable: false,

    audit: { retentionDays: 1, exportEnabled: false },

    eventLogs: {
      retentionDays: 1,
      exportEnabled: false,
      liveStreaming: false,
    },

    scheduling: { integrations: false, tasks: false },
  }
}

interface LimitsSeam {
  default: Limits
  hasPlans: boolean
}

function loadSeam(limitsConfig?: Record<string, unknown>) {
  let seam!: LimitsSeam

  if (limitsConfig === undefined) {
    delete process.env.LIMITS_CONFIG
  } else {
    process.env.LIMITS_CONFIG = JSON.stringify(limitsConfig)
  }

  // @note the module also boot-validates OVERRIDES_CONFIG against the
  // catalogue being loaded - the environment's real overrides reference the
  // environment's real plans, not the fixture's, so they must not leak into
  // an isolated load
  delete process.env.OVERRIDES_CONFIG

  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    seam = require('@/config/limits')
  })

  return seam
}

describe('@/config/limits seam', () => {
  const originalLimitsConfig = process.env.LIMITS_CONFIG
  const originalOverridesConfig = process.env.OVERRIDES_CONFIG

  afterEach(() => {
    if (originalLimitsConfig === undefined) {
      delete process.env.LIMITS_CONFIG
    } else {
      process.env.LIMITS_CONFIG = originalLimitsConfig
    }

    if (originalOverridesConfig === undefined) {
      delete process.env.OVERRIDES_CONFIG
    } else {
      process.env.OVERRIDES_CONFIG = originalOverridesConfig
    }

    jest.resetModules()
  })

  describe('planless (no LIMITS_CONFIG)', () => {
    it('reports no plans', () => {
      expect(loadSeam(undefined).hasPlans).toBe(false)
    })

    it('enumerates empty, so nothing renders or serves invented plan names', () => {
      const seam = loadSeam(undefined)

      expect(Object.keys(seam.default)).toEqual([])
      expect(JSON.stringify(seam.default)).toBe('{}')
      expect({ ...seam.default }).toEqual({})
    })

    it('resolves any plan lookup to the unlimited table', () => {
      const seam = loadSeam(undefined)

      expect(seam.default.free.tokens).toBe(Infinity)
      expect(seam.default.ultimate.database.bots).toBe(Infinity)
      expect(seam.default.anythingAtAll.rate.messages).toBe(Infinity)
    })

    it('withholds no entitlement', () => {
      const seam = loadSeam(undefined)

      expect(seam.default.free.audit.exportEnabled).toBe(true)
      expect(seam.default.free.eventLogs.exportEnabled).toBe(true)
      expect(seam.default.free.eventLogs.liveStreaming).toBe(true)
      expect(seam.default.free.widgetIntegration.canDisablePoweredBy).toBe(true)
      expect(seam.default.free.scheduling.integrations).toBe(true)
      expect(seam.default.free.scheduling.tasks).toBe(true)
    })

    it('keeps allocation sizes finite, because they provision real resources', () => {
      const table = loadSeam(undefined).default.free

      expect(Number.isFinite(table.shell.memory)).toBe(true)
      expect(Number.isFinite(table.shell.disk)).toBe(true)
      expect(Number.isFinite(table.sitemapIntegration.maxTime)).toBe(true)
      expect(Number.isFinite(table.sitemapIntegration.memory.cheerio)).toBe(
        true
      )
      expect(Number.isFinite(table.sitemapIntegration.memory.puppeteer)).toBe(
        true
      )
      expect(Number.isFinite(table.notionIntegration.maxTime)).toBe(true)
      expect(Number.isFinite(table.audit.retentionDays)).toBe(true)
      expect(Number.isFinite(table.eventLogs.retentionDays)).toBe(true)
    })
  })

  describe('with plans (named catalogue)', () => {
    it('reports plans and serves the named tables verbatim', () => {
      const seam = loadSeam({ pro: { ...fullTable(), tokens: 42 } })

      expect(seam.hasPlans).toBe(true)
      expect(Object.keys(seam.default)).toEqual(['pro'])
      expect(seam.default.pro.tokens).toBe(42)
    })

    it('resolves an unknown plan to nothing rather than the unlimited table', () => {
      const seam = loadSeam({ pro: fullTable() })

      expect(seam.default.ultimate).toBeUndefined()
    })

    it('resolves the structural unlimited plan without enumerating it', () => {
      const seam = loadSeam({ pro: fullTable() })

      expect(seam.default.unlimited.tokens).toBe(Infinity)
      expect('unlimited' in seam.default).toBe(true)

      // @note never enumerated: listings and JSON must not carry it
      expect(Object.keys(seam.default)).toEqual(['pro'])
      expect(JSON.parse(JSON.stringify(seam.default))).not.toHaveProperty(
        'unlimited'
      )
    })

    it('reserves the unlimited name - a catalogue may not define its own', () => {
      expect(() => loadSeam({ unlimited: fullTable() })).toThrow(/reserved/)
    })
  })

  describe('validation', () => {
    it('rejects a table with a missing key rather than resolving it to 0', () => {
      const table = fullTable()

      // @ts-expect-error deliberately breaking the table
      delete table.tokens

      expect(() => loadSeam({ pro: table })).toThrow()
    })

    it('rejects a misspelled key rather than dropping it', () => {
      const table = fullTable()

      // @ts-expect-error deliberately breaking the table
      table.database.dataset = 1

      expect(() => loadSeam({ pro: table })).toThrow()
    })

    it('rejects malformed JSON loudly', () => {
      process.env.LIMITS_CONFIG = '{not json'

      expect(() => {
        jest.isolateModules(() => {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('@/config/limits')
        })
      }).toThrow()
    })
  })
})

// --- the overrides section --------------------------------------------------
//
// @note the schemas live in `@/config/limits` and validate OVERRIDES_CONFIG
// at load time - a malformed override fails the boot, not just this suite.
// What stays here: the loaded configuration is re-validated with the
// environment loaded (so CI sees what production would), the strictness
// behaviour is pinned against regressions, and the compile-time guards keep
// the schema complete against the source-of-truth types.

// Renders zod issues into the assertion output on failure, empty on success.
function issues(result: z.SafeParseReturnType<unknown, unknown>) {
  return result.success ? [] : result.error.issues
}

describe('OVERRIDES_CONFIG', () => {
  it('is structurally valid as a whole', () => {
    const result = overridesSchema.safeParse(overrides)

    expect(issues(result)).toEqual([])
    expect(result.success).toBe(true)
  })

  // @note per-entry cases only exist when the environment carries entries -
  // an empty OVERRIDES_CONFIG is a valid deployment, not a broken suite
  const entryKeys = Object.keys(overrides)

  if (entryKeys.length) {
    it.each(entryKeys)('entry "%s" is a valid override', (key) => {
      const result = overrideEntrySchema.safeParse(
        (overrides as Record<string, unknown>)[key]
      )

      expect(issues(result)).toEqual([])
      expect(result.success).toBe(true)
    })
  } else {
    it.skip('validates each entry (no entries in this environment)', () => {})
  }

  it('only references known plans in plan-gated overrides', () => {
    for (const entry of Object.values(overrides)) {
      for (const plan of Object.keys(entry.plans ?? {})) {
        expect(PLAN_KEYS).toContain(plan)
      }
    }
  })
})

// @note the strictness behaviour is pinned against a fixture catalogue so it
// holds in any environment - the deployment's own schemas above bind whatever
// LIMITS_CONFIG carries (nothing at all in the planless deployment).
const { overrideEntrySchema: fixtureEntrySchema } = createOverrideSchemas([
  'free',
  'trial',
  'basic',
  'ultimate',
])

describe('override schema strictness', () => {
  it('accepts a partial nested override', () => {
    expect(
      fixtureEntrySchema.safeParse({ limits: { database: { files: 300 } } })
        .success
    ).toBe(true)
  })

  it('accepts a correctly-nested plan-gated override', () => {
    expect(
      fixtureEntrySchema.safeParse({
        plans: { basic: { limits: { database: { bots: 15 } } } },
      }).success
    ).toBe(true)
  })

  // @note a plan override without the `limits` wrapper silently leaves the
  // affected account on its base limits even though an override is present
  it('rejects a plan override missing the `limits` wrapper', () => {
    expect(
      fixtureEntrySchema.safeParse({
        plans: { basic: { database: { bots: 15 } } },
      }).success
    ).toBe(false)
  })

  // @note placing `database` directly on the entry instead of under `limits`
  // silently voids the affected account's override
  it('rejects `database` placed directly on the entry', () => {
    expect(
      fixtureEntrySchema.safeParse({ database: { bots: 500 } }).success
    ).toBe(false)
  })

  it('rejects an unknown limit key (e.g. the `dataset`/`datasets` typo)', () => {
    expect(
      fixtureEntrySchema.safeParse({ limits: { database: { dataset: 500 } } })
        .success
    ).toBe(false)
  })

  it('rejects an unknown plan', () => {
    expect(
      fixtureEntrySchema.safeParse({
        plans: { platinum: { limits: { tokens: 1 } } },
      }).success
    ).toBe(false)
  })

  it('accepts a plan grant', () => {
    expect(fixtureEntrySchema.safeParse({ plan: 'ultimate' }).success).toBe(
      true
    )
  })

  it('rejects a grant of an ungrantable plan', () => {
    expect(fixtureEntrySchema.safeParse({ plan: 'free' }).success).toBe(false)
    expect(fixtureEntrySchema.safeParse({ plan: 'trial' }).success).toBe(false)
  })

  it('rejects a grant of an unknown plan', () => {
    expect(fixtureEntrySchema.safeParse({ plan: 'platinum' }).success).toBe(
      false
    )
  })

  it('rejects an unknown top-level entry key', () => {
    expect(fixtureEntrySchema.safeParse({ limit: { tokens: 1 } }).success).toBe(
      false
    )
  })

  it('rejects a wrong value type', () => {
    expect(
      fixtureEntrySchema.safeParse({ limits: { tokens: 'lots' } }).success
    ).toBe(false)
  })
})

// --- compile-time completeness guards (verified by `pnpm check`, i.e. tsc) ---
//
// Type-only, no runtime effect: they make tsc fail if the schema drifts from
// the source-of-truth types - a new field on `LimitType` that was not also
// reflected in the overrides schemas. That is the "the schema stays complete"
// guarantee.

type MutuallyAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false

type Assert<T extends true> = T

type _LimitShapeMatchesLimitType = Assert<
  MutuallyAssignable<z.infer<typeof fullLimitSchema>, LimitType>
>

// @note there is no plan-union guard any more: plan names are deployment
// data, and PLAN_KEYS derive from the installed catalogue by construction.
void PLAN_KEYS

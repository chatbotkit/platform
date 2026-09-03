import {
  comparePlans,
  flattenLimits,
  formatLimitLabel,
  headlineEntitlements,
  limitMatrix,
  planLadder,
  sellablePlans,
} from '@/lib/plan.compare'

describe('flattenLimits', () => {
  it('flattens nested tables into dotted paths', () => {
    expect(
      flattenLimits({ tokens: 10, database: { files: 5, size: 100 } })
    ).toEqual([
      ['tokens', 10],
      ['database.files', 5],
      ['database.size', 100],
    ])
  })

  it('treats arrays as leaves', () => {
    expect(flattenLimits({ engines: ['a', 'b'] })).toEqual([
      ['engines', ['a', 'b']],
    ])
  })

  it('preserves the catalogue key order', () => {
    // @note the order is what makes the rendered list read the same way on
    // every deployment - the keys are platform vocabulary
    expect(flattenLimits({ b: 1, a: 2 }).map(([key]) => key)).toEqual([
      'b',
      'a',
    ])
  })
})

describe('formatLimitLabel', () => {
  it('renders a dotted camelCase path as a phrase', () => {
    expect(formatLimitLabel('database.files')).toBe('Database files')
    expect(formatLimitLabel('sitemapIntegration.maxUrls')).toBe(
      'Sitemap integration max URLs'
    )
    expect(formatLimitLabel('tokens')).toBe('Tokens')
  })
})

describe('comparePlans', () => {
  const basic = { tokens: 100, bots: 2, audit: { retentionDays: 7 } }
  const pro = { tokens: 500, bots: 2, audit: { retentionDays: 30 } }

  it('lists only what increases', () => {
    const { changes } = comparePlans(basic, pro)

    expect(changes.map(({ key }) => key)).toEqual([
      'tokens',
      'audit.retentionDays',
    ])

    // bots is equal on both, so it is not a reason to upgrade
    expect(changes.map(({ key }) => key)).not.toContain('bots')
  })

  it('carries both sides of each change', () => {
    const [tokens] = comparePlans(basic, pro).changes

    expect(tokens).toEqual({
      key: 'tokens',
      label: 'Tokens',
      from: 100,
      to: 500,
    })
  })

  it('counts a capability switched on', () => {
    const { changes } = comparePlans({ audit: false }, { audit: true })

    expect(changes.map(({ key }) => key)).toEqual(['audit'])
  })

  it('ignores a capability switched off and any decrease', () => {
    // @note a downgrade is not something to advertise on an upgrade page, and
    // a guessed direction would read as a feature
    expect(comparePlans({ audit: true }, { audit: false }).changes).toEqual([])
    expect(comparePlans({ tokens: 500 }, { tokens: 100 }).changes).toEqual([])
  })

  it('ignores keys the two tables disagree about the shape of', () => {
    expect(comparePlans({ tokens: 1 }, { tokens: true }).changes).toEqual([])
  })

  it('caps the list and reports the remainder', () => {
    const from = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [`k${index}`, 1])
    )

    const to = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [`k${index}`, 2])
    )

    const { changes, more } = comparePlans(from, to, { max: 3 })

    expect(changes).toHaveLength(3)
    expect(more).toBe(7)
  })

  it('returns nothing when either plan is absent from the catalogue', () => {
    // @note the case the old hand-written catalogue crashed on
    expect(comparePlans(undefined, pro)).toEqual({ changes: [], more: 0 })
    expect(comparePlans(basic, undefined)).toEqual({ changes: [], more: 0 })
  })
})

describe('sellablePlans', () => {
  const pricing = { free: 0, basic: 25, pro: 65, ultimate: Infinity }

  it('lists priced plans cheapest first', () => {
    expect(sellablePlans(pricing).map(({ plan }) => plan)).toEqual([
      'basic',
      'pro',
    ])
  })

  it('excludes the plan the user is already on', () => {
    expect(sellablePlans(pricing, 'basic').map(({ plan }) => plan)).toEqual([
      'pro',
    ])
  })

  it('excludes free and unbounded plans', () => {
    // free is not an upsell; an unbounded price is not self-serve
    const plans = sellablePlans(pricing).map(({ plan }) => plan)

    expect(plans).not.toContain('free')
    expect(plans).not.toContain('ultimate')
  })

  it('titles each plan from its own key', () => {
    // @note a deployment selling `starterPlus` renders it, with no code change
    expect(sellablePlans({ starterPlus: 10 })).toEqual([
      { plan: 'starterPlus', label: 'Starter Plus', price: 10 },
    ])
  })

  it('serves a planless deployment an empty list rather than throwing', () => {
    expect(sellablePlans(undefined)).toEqual([])
    expect(sellablePlans({})).toEqual([])
  })
})

describe('planLadder', () => {
  const pricing = { free: 0, basic: 25, pro: 65, ultimate: Infinity }

  it('lists priced and unbounded plans cheapest first', () => {
    expect(planLadder(pricing).map(({ plan }) => plan)).toEqual([
      'basic',
      'pro',
      'ultimate',
    ])
  })

  it('keeps the current plan on the ladder even when it is not for sale', () => {
    const rungs = planLadder(pricing, 'free')

    expect(rungs.map(({ plan }) => plan)).toEqual([
      'free',
      'basic',
      'pro',
      'ultimate',
    ])

    expect(rungs[0]).toEqual({
      plan: 'free',
      label: 'Free',
      price: 0,
      current: true,
      selfServe: false,
    })
  })

  it('marks the current plan and what is self-serve', () => {
    const rungs = planLadder(pricing, 'pro')

    expect(rungs.find(({ plan }) => plan === 'pro')).toMatchObject({
      current: true,
      selfServe: true,
    })

    // an unbounded price is sold by talking to someone, not by checkout
    expect(rungs.find(({ plan }) => plan === 'ultimate')).toMatchObject({
      current: false,
      selfServe: false,
    })
  })

  it('serves a planless deployment an empty ladder rather than throwing', () => {
    expect(planLadder(undefined)).toEqual([])
    expect(planLadder({})).toEqual([])
  })
})

describe('headlineEntitlements', () => {
  const table = {
    tokens: 3000000,
    conversations: 2500,
    database: { bots: 50, datasets: Infinity },
    models: { advanced: true, custom: false },
  }

  it('picks the headline limits present in the table, in display order', () => {
    expect(headlineEntitlements(table).map(({ key }) => key)).toEqual([
      'tokens',
      'conversations',
      'database.bots',
      'database.datasets',
      'models.advanced',
    ])
  })

  it('leaves an absent capability off rather than advertising it as missing', () => {
    const keys = headlineEntitlements(table).map(({ key }) => key)

    // models.custom is false; messages is not in the table at all
    expect(keys).not.toContain('models.custom')
    expect(keys).not.toContain('messages')
  })

  it('carries the value and a human label', () => {
    const [tokens] = headlineEntitlements(table)

    expect(tokens).toEqual({
      key: 'tokens',
      label: 'credit tokens per month',
      value: 3000000,
    })
  })

  it('caps the list', () => {
    expect(headlineEntitlements(table, { max: 2 })).toHaveLength(2)
  })

  it('returns nothing for an absent table', () => {
    expect(headlineEntitlements(undefined)).toEqual([])
  })
})

describe('limitMatrix', () => {
  const basic = { tokens: 100, database: { bots: 2 } }
  const pro = { tokens: 500, database: { bots: 10 }, audit: { days: 30 } }

  it('renders one row per limit with one value column per table', () => {
    const rows = limitMatrix([basic, pro])

    expect(rows.find(({ key }) => key === 'tokens')).toEqual({
      key: 'tokens',
      label: 'Tokens',
      section: '',
      values: [100, 500],
    })

    expect(rows.find(({ key }) => key === 'database.bots')).toEqual({
      key: 'database.bots',
      label: 'Bots',
      section: 'Database',
      values: [2, 10],
    })
  })

  it('keeps first-seen catalogue order across disagreeing tables', () => {
    expect(limitMatrix([basic, pro]).map(({ key }) => key)).toEqual([
      'tokens',
      'database.bots',
      'audit.days',
    ])
  })

  it('yields undefined where a table does not carry a key', () => {
    const audit = limitMatrix([basic, pro]).find(
      ({ key }) => key === 'audit.days'
    )

    expect(audit.values).toEqual([undefined, 30])
  })

  it('serves absent tables an empty matrix rather than throwing', () => {
    expect(limitMatrix([])).toEqual([])
    expect(limitMatrix([undefined, undefined])).toEqual([])
  })
})

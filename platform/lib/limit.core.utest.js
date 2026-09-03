import limits, { overrides } from '@/config/limits'

import {
  accountConversationalLimitsOk,
  accountLimitsOk,
  checkLimits,
  constructExceededAccountLimitsMessage,
  constructExceededDatabaseLimitsMessage,
  constructExceededRateLimitsMessage,
  constructExceededSpecialRateLimitsMessage,
  createKey,
  databaseLimitsOk,
  getExceededAccountLimits,
  getExceededDatabaseLimits,
  getExceededRateLimits,
  getExceededSpecialRateLimits,
  getUserLimits,
  getUserPlanLimits,
  rateLimitsOk,
  resetAccountLimits,
  resetDatabaseLimits,
  resetRateLimits,
  resolveOverrideLimits,
  specialRateLimitToValue,
  specialRateLimitsOk,
  splitLimits,
  standardLimitToValue,
} from '@/lib/limit.core'
import { fastGetUserById } from '@/lib/user.get'

// @note the catalogues are read from LIMITS_CONFIG / OVERRIDES_CONFIG, which
// the test environment does not carry, so the suite brings its own coherent
// fixtures. Every assertion below reads its expected value back from these
// same mocked modules, so the specific numbers only need to be finite,
// distinct, and consistent.

jest.mock('@/config/limits', () => {
  const table = (tokens) => ({
    tokens,

    conversations: 100,
    messages: 1_000,

    image: 10,
    video: 10,
    audio: 10,

    fetch: 100,

    email: 100,

    rate: {
      polls: 60,
      records: 60,
      abilities: 60,
      conversations: 60,
      messages: 60,
    },

    database: {
      bots: 5,
      datasets: 5,
      records: 250,
      skillsets: 5,
      abilities: 25,
      files: 25,
      users: 100,
      portals: 1,
      policies: 1,
      teams: 1,
      teamMembers: 5,
      integrations: 10,
    },

    models: { advanced: false, custom: true },

    file: { maxFileSize: 1e6 },

    attachment: { maxFileSize: 1e6 },

    shell: { memory: 512, disk: 1_024 },

    sitemapIntegration: {
      maxUrls: 10,
      maxTime: 10,
      engines: ['cheerio'],
      memory: { cheerio: 512, puppeteer: 1_024 },
    },

    notionIntegration: { maxPages: 10, maxTime: 10 },

    widgetIntegration: { canDisablePoweredBy: false },

    audit: { retentionDays: 7, exportEnabled: false },

    eventLogs: {
      retentionDays: 7,
      exportEnabled: false,
      liveStreaming: false,
    },

    scheduling: { integrations: false, tasks: false },

    upgradable: true,
  })

  // @note several cases hardcode the free table in comments and counts
  // ("free plan: database.datasets = 3"), so free pins those exact values
  const free = table(0)

  free.conversations = 100
  free.messages = 500
  free.database.datasets = 3
  free.database.records = 30

  return {
    __esModule: true,

    hasPlans: true,

    default: {
      free,
      trial: table(250_000),
      basic: table(1_000_000),
      pro: table(3_000_000),
      proPlus: table(4_000_000),
      scale: table(10_000_000),
      scalePlus: table(12_000_000),
      ultimate: table(100_000_000),
    },

    overrides: {
      abc123: {
        limits: {
          database: {
            records: 100_000,
            files: 1_000,
          },
          file: {
            maxFileSize: 5e7,
          },
        },
        plans: {
          proPlus: {
            limits: {
              tokens: 5_000_000,
            },
          },
        },
      },
    },
  }
})

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      user: { count: jest.fn() },
      bot: { count: jest.fn() },
      dataset: { count: jest.fn() },
      skillset: { count: jest.fn() },
      integration: { count: jest.fn() },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/memcache', () => ({
  pipeline: jest.fn(() => ({
    get: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  })),
}))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(),
}))

jest.mock('@/lib/user.plan', () => ({
  revealUserPlan: jest.fn(),
}))

jest.mock('@/lib/ratelimit', () => ({
  slidingWindow: jest.fn(),
}))

jest.mock('@/lib/notify', () => ({
  notifyExceededRateLimits: jest.fn(),
  notifyExceededDatabaseLimits: jest.fn(),
  notifyExceededAccountLimits: jest.fn(),
  notifyNearlyExceededDatabaseLimits: jest.fn(),
  notifyNearlyExceededAccountLimits: jest.fn(),
}))

jest.mock('@/lib/defer', () => ({
  defer: jest.fn((p) => Promise.resolve(p)),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/lib/session.context', () => ({
  getSafeSessionStore: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  throwLimitsReached: jest.fn((message) => {
    throw new Error(message || 'Limits reached')
  }),
}))

jest.mock('@/lib/usage.record', () => ({
  getUsageKey: jest.fn((userId, type) => `usage:${userId}:${type}`),
}))

jest.mock('@/lib/limit.estimate', () => ({
  getApproximateTotalBots: jest.fn(),
  getApproximateTotalDatasets: jest.fn(),
  getApproximateTotalRecords: jest.fn(),
  getApproximateTotalSkillsets: jest.fn(),
  getApproximateTotalAbilities: jest.fn(),
  getApproximateTotalFiles: jest.fn(),
  getApproximateTotalPortals: jest.fn(),
  getApproximateTotalPolicies: jest.fn(),
  getApproximateTotalTeams: jest.fn(),
  getApproximateTotalTeamMembers: jest.fn(),
}))

afterEach(() => {
  jest.clearAllMocks()
  delete process.env.SKIP_LIMITS_CHECK
})

describe('limits', () => {
  it('limits must match schema', () => {
    // @todo add code here
  })
})

describe('splitLimits', () => {
  it('must correctly split the limits', () => {
    expect(splitLimits(['rate/conversations'])).toEqual({
      rateLimits: ['rate/conversations'],
      databaseLimits: [],
      fileLimits: [],
      accountLimits: [],
      specialRateLimits: [],
    })

    expect(splitLimits(['database/datasets'])).toEqual({
      rateLimits: [],
      databaseLimits: ['database/datasets'],
      fileLimits: [],
      accountLimits: [],
      specialRateLimits: [],
    })

    expect(splitLimits(['conversations'])).toEqual({
      rateLimits: [],
      databaseLimits: [],
      fileLimits: [],
      accountLimits: ['conversations'],
      specialRateLimits: [],
    })

    expect(
      splitLimits(['rate/conversations', 'database/datasets', 'messages'])
    ).toEqual({
      rateLimits: ['rate/conversations'],
      databaseLimits: ['database/datasets'],
      fileLimits: [],
      accountLimits: ['messages'],
      specialRateLimits: [],
    })

    expect(splitLimits(['file/maxFileSize'])).toEqual({
      rateLimits: [],
      databaseLimits: [],
      fileLimits: ['file/maxFileSize'],
      accountLimits: [],
      specialRateLimits: [],
    })

    expect(splitLimits(['rate/poll'])).toEqual({
      rateLimits: ['rate/poll'],
      databaseLimits: [],
      fileLimits: [],
      accountLimits: [],
      specialRateLimits: [],
    })
  })
})

describe('standardLimitToValue', () => {
  it('must correctly return value', async () => {
    await expect(
      standardLimitToValue(
        'free',
        // @ts-ignore
        'test'
      )
    ).resolves.toEqual(0)

    await expect(standardLimitToValue('free', 'tokens')).resolves.toEqual(
      limits.free.tokens
    )

    await expect(
      standardLimitToValue('free', 'database/ability')
    ).resolves.toEqual(limits.free.database.abilities)

    await expect(
      standardLimitToValue(
        // @ts-ignore
        'abc123',
        'tokens'
      )
    ).rejects.toThrow()

    await expect(
      standardLimitToValue(
        'free',
        // @ts-ignore
        'rate/test'
      )
    ).resolves.toEqual(0)

    await expect(
      standardLimitToValue('free', 'rate/abilities')
    ).resolves.toEqual(limits.free.rate.abilities)

    await expect(standardLimitToValue('free', 'rate/poll')).resolves.toEqual(
      limits.free.rate.polls
    )

    await expect(
      standardLimitToValue(
        // @ts-ignore
        'abc123',
        'rate/conversations'
      )
    ).rejects.toThrow()
  })

  it('must correctly return value with custom limits', async () => {
    await expect(
      standardLimitToValue('free', 'database/records', {
        id: 'abc123',
        email: 'test@abc123.com',
      })
    ).resolves.toEqual(overrides['abc123'].limits.database.records)

    await expect(
      standardLimitToValue('free', 'database/files', {
        id: 'abc123',
        email: 'test@abc123.com',
      })
    ).resolves.toEqual(overrides['abc123'].limits.database.files)

    await expect(
      standardLimitToValue('free', 'file/maxFileSize', {
        id: 'abc123',
        email: 'test@abc123.com',
      })
    ).resolves.toEqual(overrides['abc123'].limits.file.maxFileSize)
  })

  it('must apply plan-gated overrides only on the matching plan', async () => {
    const user = { id: 'abc123', email: 'test@abc123.com' }

    // on proPlus the grandfathered token override applies

    await expect(standardLimitToValue('proPlus', 'tokens', user)).resolves.toBe(
      overrides['abc123'].plans.proPlus.limits.tokens
    )

    // on any other plan it must fall back to that plan's base tokens

    await expect(standardLimitToValue('free', 'tokens', user)).resolves.toBe(
      limits.free.tokens
    )

    await expect(standardLimitToValue('pro', 'tokens', user)).resolves.toBe(
      limits.pro.tokens
    )
  })

  it('must correctly return custom limits', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'xyz123',
      email: 'child.com',
      parentId: 'parent123',

      limits: {
        database: {
          records: 10,
        },
      },
    })

    await expect(
      standardLimitToValue('free', 'database/records', {
        id: 'xyz123',
        email: 'child.com',
        parentId: 'parent123',
      })
    ).resolves.toEqual(10)
  })

  it('must return min value when the custom limit is large', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'xyz123',
      email: 'child.com',
      parentId: 'parent123',

      limits: {
        database: {
          records: 1_000_000,
        },
      },
    })

    await expect(
      standardLimitToValue('free', 'database/records', {
        id: 'xyz123',
        email: 'child.com',
        parentId: 'parent123',
      })
    ).resolves.toEqual(limits.free.database.records)
  })

  it('must return default value when the custom limit is negative', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'xyz123',
      email: 'child.com',
      parentId: 'parent123',

      limits: {
        database: {
          records: -1,
        },
      },
    })

    await expect(
      standardLimitToValue('free', 'database/records', {
        id: 'xyz123',
        email: 'child.com',
        parentId: 'parent123',
      })
    ).resolves.toEqual(limits.free.database.records)
  })

  it('must return default value when the custom limit is infinite', async () => {
    fastGetUserById.mockResolvedValue({
      id: 'xyz123',
      email: 'child.com',
      parentId: 'parent123',

      limits: {
        database: {
          records: Infinity,
        },
      },
    })

    await expect(
      standardLimitToValue('free', 'database/records', {
        id: 'xyz123',
        email: 'child.com',
        parentId: 'parent123',
      })
    ).resolves.toEqual(limits.free.database.records)
  })
})

describe('getUserPlanLimits', () => {
  it('must return correct limits for free plan', async () => {
    const user = {
      id: 'user123',
      email: 'test@example.com',
    }

    const result = await getUserPlanLimits(user, 'free')

    expect(result).toEqual(limits.free)
    expect(result.tokens).toBe(limits.free.tokens)
    expect(result.database.records).toBe(limits.free.database.records)
  })

  it('must return correct limits for basic plan', async () => {
    const user = {
      id: 'user123',
      email: 'test@example.com',
    }

    const result = await getUserPlanLimits(user, 'basic')

    expect(result).toEqual(limits.basic)
    expect(result.tokens).toBe(limits.basic.tokens)
    expect(result.database.records).toBe(limits.basic.database.records)
  })

  it('must return correct limits for pro plan', async () => {
    const user = {
      id: 'user123',
      email: 'test@example.com',
    }

    const result = await getUserPlanLimits(user, 'pro')

    expect(result).toEqual(limits.pro)
    expect(result.tokens).toBe(limits.pro.tokens)
    expect(result.database.records).toBe(limits.pro.database.records)
  })

  it('must throw error for unknown plan', async () => {
    const user = {
      id: 'user123',
      email: 'test@example.com',
    }

    await expect(getUserPlanLimits(user, 'invalid-plan')).rejects.toThrow()
  })

  it('must apply overrides for specific user', async () => {
    const user = {
      id: 'abc123',
      email: 'test@abc123.com',
    }

    const result = await getUserPlanLimits(user, 'free')

    expect(result.database.records).toBe(
      overrides['abc123'].limits.database.records
    )
    expect(result.database.files).toBe(
      overrides['abc123'].limits.database.files
    )
    expect(result.file.maxFileSize).toBe(
      overrides['abc123'].limits.file.maxFileSize
    )

    // @note other limits should remain from base plan

    expect(result.tokens).toBe(limits.free.tokens)
  })

  it('must apply plan-gated overrides only on the matching plan', async () => {
    const user = { id: 'abc123', email: 'test@abc123.com' }

    // on proPlus the grandfathered token override applies

    const proPlusResult = await getUserPlanLimits(user, 'proPlus')

    expect(proPlusResult.tokens).toBe(
      overrides['abc123'].plans.proPlus.limits.tokens
    )

    // on any other plan it must fall back to that plan's base tokens

    const freeResult = await getUserPlanLimits(user, 'free')

    expect(freeResult.tokens).toBe(limits.free.tokens)

    // unconditional overrides still apply regardless of plan

    expect(proPlusResult.database.records).toBe(
      overrides['abc123'].limits.database.records
    )
  })

  it('must handle user with custom limits', async () => {
    const user = {
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
    }

    fastGetUserById.mockResolvedValue({
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
      limits: {
        database: {
          records: 50,
          files: 5,
        },
        tokens: 5000,
      },
    })

    // @note use a base plan with headroom so this exercises the "partner limit
    // below the plan cap is applied as-is" path. The free plan now grants 0
    // tokens, so on free it could only ever demonstrate capping-down - which
    // the next test ('must cap partner limits to base plan limits') covers.
    const result = await getUserPlanLimits(user, 'basic')

    // Partner limits should be applied but capped at base plan limits
    // Since partner limits are applied with Math.min, they can only reduce
    expect(result.database.records).toBe(
      Math.min(50, limits.basic.database.records)
    )
    expect(result.database.files).toBe(Math.min(5, limits.basic.database.files))
    // Token limit (5000) is below the basic plan cap, so it is applied as-is
    expect(result.tokens).toBe(Math.min(5000, limits.basic.tokens))
  })

  it('must cap partner limits to base plan limits', async () => {
    const user = {
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
    }

    fastGetUserById.mockResolvedValue({
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
      limits: {
        database: {
          records: 1_000_000,
        },
        tokens: 1_000_000,
      },
    })

    const result = await getUserPlanLimits(user, 'free')

    // Partner limits should be capped at base plan limits
    expect(result.database.records).toBe(limits.free.database.records)
    expect(result.tokens).toBe(limits.free.tokens)
  })

  it('must ignore negative partner limits', async () => {
    const user = {
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
    }

    fastGetUserById.mockResolvedValue({
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
      limits: {
        database: {
          records: -1,
        },
        tokens: -100,
      },
    })

    const result = await getUserPlanLimits(user, 'free')

    // Negative limits should be ignored, falling back to base plan
    expect(result.database.records).toBe(limits.free.database.records)
    expect(result.tokens).toBe(limits.free.tokens)
  })

  it('must ignore infinite partner limits', async () => {
    const user = {
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
    }

    fastGetUserById.mockResolvedValue({
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
      limits: {
        database: {
          records: Infinity,
        },
        tokens: Infinity,
      },
    })

    const result = await getUserPlanLimits(user, 'free')

    // Infinite limits should be ignored, falling back to base plan
    expect(result.database.records).toBe(limits.free.database.records)
    expect(result.tokens).toBe(limits.free.tokens)
  })

  it('must ignore NaN partner limits', async () => {
    const user = {
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
    }

    fastGetUserById.mockResolvedValue({
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
      limits: {
        database: {
          records: NaN,
        },
        tokens: NaN,
      },
    })

    const result = await getUserPlanLimits(user, 'free')

    // NaN limits should be ignored, falling back to base plan
    expect(result.database.records).toBe(limits.free.database.records)
    expect(result.tokens).toBe(limits.free.tokens)
  })

  it('must ignore unknown partner limit keys', async () => {
    const user = {
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
    }

    fastGetUserById.mockResolvedValue({
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
      limits: {
        database: {
          records: 50,
          unknownKey: 999,
        },
        unknownCategory: {
          something: 123,
        },
      },
    })

    const result = await getUserPlanLimits(user, 'free')

    // Valid partner limits should be applied
    expect(result.database.records).toBe(
      Math.min(50, limits.free.database.records)
    )
    // Unknown keys should be ignored
    expect(result.database).not.toHaveProperty('unknownKey')
    expect(result).not.toHaveProperty('unknownCategory')
  })

  it('must handle user with no custom limits', async () => {
    const user = {
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
    }

    fastGetUserById.mockResolvedValue({
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
    })

    const result = await getUserPlanLimits(user, 'free')

    // Should return base plan limits
    expect(result).toEqual(limits.free)
  })

  it('must handle user with null limits', async () => {
    const user = {
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
    }

    fastGetUserById.mockResolvedValue({
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
      limits: null,
    })

    const result = await getUserPlanLimits(user, 'free')

    // Should return base plan limits
    expect(result).toEqual(limits.free)
  })

  it('must handle user with non-object limits', async () => {
    const user = {
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
    }

    fastGetUserById.mockResolvedValue({
      id: 'partner123',
      email: 'child.com',
      parentId: 'parent123',
      limits: 'invalid',
    })

    const result = await getUserPlanLimits(user, 'free')

    // Should return base plan limits
    expect(result).toEqual(limits.free)
  })

  it('must combine overrides and partner limits correctly', async () => {
    const user = {
      id: 'abc123',
      email: 'child.com',
      parentId: 'parent123',
    }

    fastGetUserById.mockResolvedValue({
      id: 'abc123',
      email: 'child.com',
      parentId: 'parent123',
      limits: {
        database: {
          records: 50000,
        },
      },
    })

    const result = await getUserPlanLimits(user, 'free')

    // Override is applied first (100000), then partner limit (50000) is compared
    // Math.min(50000, 100000) = 50000, which is merged back into base
    // So the final result should be 50000
    expect(result.database.records).toBe(50000)
    // File override should remain
    expect(result.database.files).toBe(
      overrides['abc123'].limits.database.files
    )
  })
})

describe('createKey', () => {
  it('should join parts with hyphen', () => {
    expect(createKey('a', 'b', 'c')).toBe('a-b-c')
  })

  it('should filter out falsy values', () => {
    expect(createKey('a', null, 'b', undefined, 'c')).toBe('a-b-c')
  })

  it('should filter out empty strings', () => {
    expect(createKey('a', '', 'b')).toBe('a-b')
  })

  it('should return single part unchanged', () => {
    expect(createKey('key')).toBe('key')
  })

  it('should return empty string when all parts are falsy', () => {
    expect(createKey(null, undefined)).toBe('')
  })

  it('should return empty string with no arguments', () => {
    expect(createKey()).toBe('')
  })
})

describe('constructExceededRateLimitsMessage', () => {
  it('should construct message for a single exceeded limit', () => {
    expect(constructExceededRateLimitsMessage(['rate/conversations'])).toBe(
      'You have exceeded your allocated rate limits: rate/conversations'
    )
  })

  it('should construct message for multiple exceeded limits', () => {
    expect(
      constructExceededRateLimitsMessage([
        'rate/conversations',
        'rate/messages',
      ])
    ).toBe(
      'You have exceeded your allocated rate limits: rate/conversations, rate/messages'
    )
  })

  it('should handle an empty limits array', () => {
    expect(constructExceededRateLimitsMessage([])).toBe(
      'You have exceeded your allocated rate limits: '
    )
  })
})

describe('constructExceededDatabaseLimitsMessage', () => {
  it('should construct message for a single exceeded limit', () => {
    expect(constructExceededDatabaseLimitsMessage(['database/bots'])).toBe(
      'You have exceeded your allocated database limits: database/bots'
    )
  })

  it('should construct message for multiple exceeded limits', () => {
    expect(
      constructExceededDatabaseLimitsMessage([
        'database/bots',
        'database/datasets',
      ])
    ).toBe(
      'You have exceeded your allocated database limits: database/bots, database/datasets'
    )
  })

  it('should handle an empty limits array', () => {
    expect(constructExceededDatabaseLimitsMessage([])).toBe(
      'You have exceeded your allocated database limits: '
    )
  })
})

describe('constructExceededAccountLimitsMessage', () => {
  it('should construct message for a single exceeded limit', () => {
    expect(constructExceededAccountLimitsMessage(['conversation'])).toBe(
      'You have exceeded your allocated account limits: conversation'
    )
  })

  it('should construct message for multiple exceeded limits', () => {
    expect(
      constructExceededAccountLimitsMessage([
        'conversation',
        'message',
        'token',
      ])
    ).toBe(
      'You have exceeded your allocated account limits: conversation, message, token'
    )
  })

  it('should handle an empty limits array', () => {
    expect(constructExceededAccountLimitsMessage([])).toBe(
      'You have exceeded your allocated account limits: '
    )
  })
})

describe('constructExceededSpecialRateLimitsMessage', () => {
  it('should construct message for a single exceeded limit', () => {
    expect(
      constructExceededSpecialRateLimitsMessage(['special/rate/initiate'])
    ).toBe('You have exceeded your allocated limits: special/rate/initiate')
  })

  it('should construct message for multiple exceeded limits', () => {
    expect(
      constructExceededSpecialRateLimitsMessage([
        'special/rate/initiate',
        'special/rate/other',
      ])
    ).toBe(
      'You have exceeded your allocated limits: special/rate/initiate, special/rate/other'
    )
  })

  it('should handle an empty limits array', () => {
    expect(constructExceededSpecialRateLimitsMessage([])).toBe(
      'You have exceeded your allocated limits: '
    )
  })
})

// ---------------------------------------------------------------------------
// Enforcement functions
// ---------------------------------------------------------------------------

const TEST_USER = { id: 'user-1', email: 'test@example.com' }

/** Shortcut to get the user.plan mock module */
const userPlanMock = () => jest.requireMock('@/lib/user.plan')

/** Shortcut to get the ratelimit mock module */
const ratelimitMock = () => jest.requireMock('@/lib/ratelimit')

/** Shortcut to get the notify mock module */
const notifyMock = () => jest.requireMock('@/lib/notify')

/** Shortcut to get the limit.estimate mock module */
const estimateMock = () => jest.requireMock('@/lib/limit.estimate')

/** Shortcut to get the error mock module */
const errorMock = () => jest.requireMock('@/lib/error')

/** Override the redis pipeline to return custom exec values */
function mockRedisPipeline(execValues) {
  const memcache = jest.requireMock('@/lib/memcache')
  const mockDel = jest.fn().mockReturnThis()
  const mockGet = jest.fn().mockReturnThis()
  const mockExec = jest.fn().mockResolvedValue(execValues)

  memcache.pipeline.mockReturnValue({
    get: mockGet,
    set: jest.fn().mockReturnThis(),
    del: mockDel,
    exec: mockExec,
  })

  return { mockGet, mockDel, mockExec }
}

describe('getExceededRateLimits', () => {
  beforeEach(() => {
    userPlanMock().revealUserPlan.mockResolvedValue({
      plan: 'free',
      effectiveUser: TEST_USER,
    })
    ratelimitMock().slidingWindow.mockResolvedValue({ success: true })
    jest.requireMock('@/lib/user.get').fastGetUserById.mockResolvedValue(null)
  })

  it('should return an empty array when all rate limits pass', async () => {
    const exceeded = await getExceededRateLimits(TEST_USER, [
      'rate/message',
      'rate/conversation',
    ])

    expect(exceeded).toEqual([])
  })

  it('should return the limit when the sliding window check fails', async () => {
    ratelimitMock().slidingWindow.mockResolvedValue({ success: false })

    const exceeded = await getExceededRateLimits(TEST_USER, ['rate/message'])

    expect(exceeded).toEqual(['rate/message'])
  })

  it('should return only the failed limits when some pass and some fail', async () => {
    ratelimitMock()
      .slidingWindow.mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false })

    const exceeded = await getExceededRateLimits(TEST_USER, [
      'rate/message',
      'rate/conversation',
    ])

    expect(exceeded).toEqual(['rate/conversation'])
  })

  it('should return an empty array when no limits are provided', async () => {
    const exceeded = await getExceededRateLimits(TEST_USER, [])

    expect(exceeded).toEqual([])
  })
})

describe('getExceededDatabaseLimits', () => {
  beforeEach(() => {
    userPlanMock().revealUserPlan.mockResolvedValue({
      plan: 'free',
      effectiveUser: TEST_USER,
    })
    jest.requireMock('@/lib/user.get').fastGetUserById.mockResolvedValue(null)

    // Default: all counts well below free-plan limits
    estimateMock().getApproximateTotalBots.mockResolvedValue(0)
    estimateMock().getApproximateTotalDatasets.mockResolvedValue(0)
    estimateMock().getApproximateTotalRecords.mockResolvedValue(0)
    estimateMock().getApproximateTotalSkillsets.mockResolvedValue(0)
    estimateMock().getApproximateTotalAbilities.mockResolvedValue(0)
    estimateMock().getApproximateTotalFiles.mockResolvedValue(0)
    estimateMock().getApproximateTotalPortals.mockResolvedValue(0)
    estimateMock().getApproximateTotalPolicies.mockResolvedValue(0)
    estimateMock().getApproximateTotalTeams.mockResolvedValue(0)
    estimateMock().getApproximateTotalTeamMembers.mockResolvedValue(0)
  })

  it('should check bot usage with the configured database bot limit', async () => {
    estimateMock().getApproximateTotalBots.mockResolvedValue(1)

    const result = await getExceededDatabaseLimits(TEST_USER, ['database/bot'])

    expect(result.exceededLimits).toEqual([])
    expect(result.nearlyExceededLimits).toEqual([])
    expect(estimateMock().getApproximateTotalBots).toHaveBeenCalledWith(
      TEST_USER
    )
  })

  it('should return no exceeded limits when usage is well below the plan limit', async () => {
    // free plan: database.datasets = 3; current = 1
    estimateMock().getApproximateTotalDatasets.mockResolvedValue(1)

    const result = await getExceededDatabaseLimits(TEST_USER, [
      'database/datasets',
    ])

    expect(result.exceededLimits).toEqual([])
    expect(result.nearlyExceededLimits).toEqual([])
  })

  it('should return the limit as exceeded when count meets the plan value', async () => {
    // free plan: database.datasets = 3; current = 3 -> diff = 0 <= 0
    estimateMock().getApproximateTotalDatasets.mockResolvedValue(3)

    const result = await getExceededDatabaseLimits(TEST_USER, [
      'database/datasets',
    ])

    expect(result.exceededLimits).toContain('database/datasets')
    expect(result.nearlyExceededLimits).toEqual([])
  })

  it('should return the limit as exceeded when count exceeds the plan value', async () => {
    // free plan: database.datasets = 3; current = 4
    estimateMock().getApproximateTotalDatasets.mockResolvedValue(4)

    const result = await getExceededDatabaseLimits(TEST_USER, [
      'database/datasets',
    ])

    expect(result.exceededLimits).toContain('database/datasets')
  })

  it('should return the limit as nearly exceeded when usage is above 90%', async () => {
    // free plan: database.records = 30; 28/30 = 0.933 > 0.9 and diff = 2 > 0
    estimateMock().getApproximateTotalRecords.mockResolvedValue(28)

    const result = await getExceededDatabaseLimits(TEST_USER, [
      'database/records',
    ])

    expect(result.exceededLimits).toEqual([])
    expect(result.nearlyExceededLimits).toContain('database/records')
  })

  it('should handle plural limit names - pluralize normalises before switch', async () => {
    // 'database/datasets' is plural; pluralize(limit, 1) yields 'database/dataset'
    // which must match the switch case 'database/dataset'
    estimateMock().getApproximateTotalDatasets.mockResolvedValue(4)

    const result = await getExceededDatabaseLimits(TEST_USER, [
      'database/datasets',
    ])

    expect(result.exceededLimits).toContain('database/datasets')
  })
})

describe('getExceededAccountLimits', () => {
  beforeEach(() => {
    userPlanMock().revealUserPlan.mockResolvedValue({
      plan: 'free',
      effectiveUser: TEST_USER,
    })
    jest.requireMock('@/lib/user.get').fastGetUserById.mockResolvedValue(null)
    mockRedisPipeline([0])
  })

  it('should return no exceeded limits when usage is below the plan limit', async () => {
    // free plan: conversations = 100; current = 50
    mockRedisPipeline([50])

    const result = await getExceededAccountLimits(TEST_USER, ['conversation'])

    expect(result.exceededLimits).toEqual([])
    expect(result.nearlyExceededLimits).toEqual([])
  })

  it('should return the limit as exceeded when usage equals the plan value', async () => {
    // free plan: conversations = 100; current = 100 -> diff = 0 <= 0
    mockRedisPipeline([100])

    const result = await getExceededAccountLimits(TEST_USER, ['conversation'])

    expect(result.exceededLimits).toContain('conversation')
    expect(result.nearlyExceededLimits).toEqual([])
  })

  it('should return the limit as nearly exceeded when usage is above 90%', async () => {
    // free plan: conversations = 100; 95/100 = 0.95 > 0.9 and diff = 5 > 0
    mockRedisPipeline([95])

    const result = await getExceededAccountLimits(TEST_USER, ['conversation'])

    expect(result.exceededLimits).toEqual([])
    expect(result.nearlyExceededLimits).toContain('conversation')
  })

  it('should treat a null redis value (missing key) as zero usage', async () => {
    mockRedisPipeline([null])

    const result = await getExceededAccountLimits(TEST_USER, ['conversation'])

    expect(result.exceededLimits).toEqual([])
  })

  it('should handle multiple limits in a single call', async () => {
    // conversation=100 (exceeded), message=10 (well below 500)
    mockRedisPipeline([100, 10])

    const result = await getExceededAccountLimits(TEST_USER, [
      'conversation',
      'message',
    ])

    expect(result.exceededLimits).toContain('conversation')
    expect(result.exceededLimits).not.toContain('message')
  })
})

describe('rateLimitsOk', () => {
  beforeEach(() => {
    userPlanMock().revealUserPlan.mockResolvedValue({
      plan: 'free',
      effectiveUser: TEST_USER,
    })
    ratelimitMock().slidingWindow.mockResolvedValue({ success: true })
    jest.requireMock('@/lib/user.get').fastGetUserById.mockResolvedValue(null)
  })

  it('should return true when no rate limits are exceeded', async () => {
    const ok = await rateLimitsOk(TEST_USER, ['rate/message'])

    expect(ok).toBe(true)
  })

  it('should return false when a rate limit is exceeded', async () => {
    ratelimitMock().slidingWindow.mockResolvedValue({ success: false })

    const ok = await rateLimitsOk(TEST_USER, ['rate/message'])

    expect(ok).toBe(false)
  })

  it('should notify when a rate limit is exceeded', async () => {
    ratelimitMock().slidingWindow.mockResolvedValue({ success: false })

    await rateLimitsOk(TEST_USER, ['rate/message'])

    expect(notifyMock().notifyExceededRateLimits).toHaveBeenCalledWith(
      TEST_USER,
      ['rate/message']
    )
  })

  it('should populate the context with exceeded limits', async () => {
    ratelimitMock().slidingWindow.mockResolvedValue({ success: false })

    const context = { exceededLimits: [] }

    await rateLimitsOk(TEST_USER, ['rate/message'], context)

    expect(context.exceededLimits).toContain('rate/message')
  })

  it('should return true immediately when SKIP_LIMITS_CHECK is set', async () => {
    process.env.SKIP_LIMITS_CHECK = '1'

    const ok = await rateLimitsOk(TEST_USER, ['rate/message'])

    expect(ok).toBe(true)
    expect(ratelimitMock().slidingWindow).not.toHaveBeenCalled()
  })

  it('should capture notification errors without propagating them', async () => {
    ratelimitMock().slidingWindow.mockResolvedValue({ success: false })
    notifyMock().notifyExceededRateLimits.mockRejectedValue(
      new Error('notify failed')
    )

    await expect(rateLimitsOk(TEST_USER, ['rate/message'])).resolves.toBe(false)
    expect(errorMock().captureException).toHaveBeenCalled()
  })
})

describe('databaseLimitsOk', () => {
  beforeEach(() => {
    userPlanMock().revealUserPlan.mockResolvedValue({
      plan: 'free',
      effectiveUser: TEST_USER,
    })
    jest.requireMock('@/lib/user.get').fastGetUserById.mockResolvedValue(null)

    estimateMock().getApproximateTotalBots.mockResolvedValue(0)
    estimateMock().getApproximateTotalDatasets.mockResolvedValue(0)
    estimateMock().getApproximateTotalRecords.mockResolvedValue(0)
    estimateMock().getApproximateTotalSkillsets.mockResolvedValue(0)
    estimateMock().getApproximateTotalAbilities.mockResolvedValue(0)
    estimateMock().getApproximateTotalFiles.mockResolvedValue(0)
    estimateMock().getApproximateTotalPortals.mockResolvedValue(0)
    estimateMock().getApproximateTotalPolicies.mockResolvedValue(0)
    estimateMock().getApproximateTotalTeams.mockResolvedValue(0)
    estimateMock().getApproximateTotalTeamMembers.mockResolvedValue(0)
  })

  it('should return true when no database limits are exceeded', async () => {
    estimateMock().getApproximateTotalDatasets.mockResolvedValue(1)

    const ok = await databaseLimitsOk(TEST_USER, ['database/datasets'])

    expect(ok).toBe(true)
  })

  it('should return false when a database limit is exceeded', async () => {
    // free plan: database.datasets = 3; current = 4
    estimateMock().getApproximateTotalDatasets.mockResolvedValue(4)

    const ok = await databaseLimitsOk(TEST_USER, ['database/datasets'])

    expect(ok).toBe(false)
  })

  it('should notify when a database limit is exceeded', async () => {
    estimateMock().getApproximateTotalDatasets.mockResolvedValue(4)

    await databaseLimitsOk(TEST_USER, ['database/datasets'])

    expect(notifyMock().notifyExceededDatabaseLimits).toHaveBeenCalledWith(
      TEST_USER,
      ['database/datasets']
    )
  })

  it('should populate context exceeded limits when a limit is exceeded', async () => {
    estimateMock().getApproximateTotalDatasets.mockResolvedValue(4)

    const context = { exceededLimits: [], nearlyExceededLimits: [] }

    await databaseLimitsOk(TEST_USER, ['database/datasets'], context)

    expect(context.exceededLimits).toContain('database/datasets')
  })

  it('should return true and notify when a limit is nearly exceeded', async () => {
    // free plan: database.records = 30; 28/30 = 0.933 > 0.9
    estimateMock().getApproximateTotalRecords.mockResolvedValue(28)

    const ok = await databaseLimitsOk(TEST_USER, ['database/records'])

    expect(ok).toBe(true)
    expect(
      notifyMock().notifyNearlyExceededDatabaseLimits
    ).toHaveBeenCalledWith(TEST_USER, ['database/records'])
  })

  it('should populate context nearly exceeded limits', async () => {
    estimateMock().getApproximateTotalRecords.mockResolvedValue(28)

    const context = { exceededLimits: [], nearlyExceededLimits: [] }

    await databaseLimitsOk(TEST_USER, ['database/records'], context)

    expect(context.nearlyExceededLimits).toContain('database/records')
  })

  it('should return true immediately when SKIP_LIMITS_CHECK is set', async () => {
    process.env.SKIP_LIMITS_CHECK = '1'
    estimateMock().getApproximateTotalDatasets.mockResolvedValue(4)

    const ok = await databaseLimitsOk(TEST_USER, ['database/datasets'])

    expect(ok).toBe(true)
    expect(estimateMock().getApproximateTotalDatasets).not.toHaveBeenCalled()
  })

  it('should capture notification errors without propagating them', async () => {
    estimateMock().getApproximateTotalDatasets.mockResolvedValue(4)
    notifyMock().notifyExceededDatabaseLimits.mockRejectedValue(
      new Error('notify failed')
    )

    await expect(
      databaseLimitsOk(TEST_USER, ['database/datasets'])
    ).resolves.toBe(false)
    expect(errorMock().captureException).toHaveBeenCalled()
  })
})

describe('accountLimitsOk', () => {
  beforeEach(() => {
    userPlanMock().revealUserPlan.mockResolvedValue({
      plan: 'free',
      effectiveUser: TEST_USER,
    })
    jest.requireMock('@/lib/user.get').fastGetUserById.mockResolvedValue(null)
    mockRedisPipeline([0])
  })

  it('should return true when account usage is below the plan limit', async () => {
    mockRedisPipeline([50]) // 50 < 100 conversations

    const ok = await accountLimitsOk(TEST_USER, ['conversation'])

    expect(ok).toBe(true)
  })

  it('should return false when an account limit is exceeded', async () => {
    mockRedisPipeline([100]) // 100 >= 100

    const ok = await accountLimitsOk(TEST_USER, ['conversation'])

    expect(ok).toBe(false)
  })

  it('should notify when an account limit is exceeded', async () => {
    mockRedisPipeline([100])

    await accountLimitsOk(TEST_USER, ['conversation'])

    expect(notifyMock().notifyExceededAccountLimits).toHaveBeenCalledWith(
      TEST_USER,
      ['conversation']
    )
  })

  it('should populate context exceeded limits when a limit is exceeded', async () => {
    mockRedisPipeline([100])

    const context = { exceededLimits: [], nearlyExceededLimits: [] }

    await accountLimitsOk(TEST_USER, ['conversation'], context)

    expect(context.exceededLimits).toContain('conversation')
  })

  it('should return true and notify when a limit is nearly exceeded', async () => {
    mockRedisPipeline([95]) // 95/100 = 0.95 > 0.9

    const ok = await accountLimitsOk(TEST_USER, ['conversation'])

    expect(ok).toBe(true)
    expect(notifyMock().notifyNearlyExceededAccountLimits).toHaveBeenCalledWith(
      TEST_USER,
      ['conversation']
    )
  })

  it('should populate context nearly exceeded limits', async () => {
    mockRedisPipeline([95])

    const context = { exceededLimits: [], nearlyExceededLimits: [] }

    await accountLimitsOk(TEST_USER, ['conversation'], context)

    expect(context.nearlyExceededLimits).toContain('conversation')
  })

  it('should return true immediately when SKIP_LIMITS_CHECK is set', async () => {
    process.env.SKIP_LIMITS_CHECK = '1'

    const ok = await accountLimitsOk(TEST_USER, ['conversation'])

    expect(ok).toBe(true)
    expect(jest.requireMock('@/lib/memcache').pipeline).not.toHaveBeenCalled()
  })

  it('should capture notification errors without propagating them', async () => {
    mockRedisPipeline([100])
    notifyMock().notifyExceededAccountLimits.mockRejectedValue(
      new Error('notify failed')
    )

    await expect(accountLimitsOk(TEST_USER, ['conversation'])).resolves.toBe(
      false
    )
    expect(errorMock().captureException).toHaveBeenCalled()
  })
})

describe('accountConversationalLimitsOk', () => {
  beforeEach(() => {
    userPlanMock().revealUserPlan.mockResolvedValue({
      plan: 'free',
      effectiveUser: TEST_USER,
    })
    jest.requireMock('@/lib/user.get').fastGetUserById.mockResolvedValue(null)
    // Free plan: conversations=100, messages=500, tokens=0; usage all at 0
    mockRedisPipeline([0, 0, 0])
  })

  it('should return true when all conversational limits pass', async () => {
    // @note the free plan now grants 0 tokens, so the happy path (usage below
    // every limit) can only be exercised on a plan with a positive token cap
    userPlanMock().revealUserPlan.mockResolvedValue({
      plan: 'basic',
      effectiveUser: TEST_USER,
    })

    const ok = await accountConversationalLimitsOk(TEST_USER)

    expect(ok).toBe(true)
  })

  it('should return false on the free plan because it grants no tokens', async () => {
    // @note free.tokens is 0, so the token limit is exceeded even at zero
    // usage - this is the deliberate abuse-prevention behaviour
    const ok = await accountConversationalLimitsOk(TEST_USER)

    expect(ok).toBe(false)
  })

  it('should check conversation, message and token limits', async () => {
    const { mockGet } = mockRedisPipeline([0, 0, 0])

    await accountConversationalLimitsOk(TEST_USER)

    // One redis GET per limit type
    expect(mockGet).toHaveBeenCalledTimes(3)
  })

  it('should return false when the conversation limit is exceeded', async () => {
    // conversations=100 exceeded; messages and tokens ok
    mockRedisPipeline([100, 10, 1000])

    const ok = await accountConversationalLimitsOk(TEST_USER)

    expect(ok).toBe(false)
  })
})

describe('resetRateLimits', () => {
  it('should delete the rate limit key via the redis pipeline', async () => {
    const { mockDel, mockExec } = mockRedisPipeline([1])

    await resetRateLimits(TEST_USER, ['rate/message'])

    expect(mockDel).toHaveBeenCalledWith(expect.stringContaining(TEST_USER.id))
    expect(mockExec).toHaveBeenCalled()
  })

  it('should delete one key per limit when multiple limits are given', async () => {
    const { mockDel } = mockRedisPipeline([1, 1])

    await resetRateLimits(TEST_USER, ['rate/message', 'rate/conversation'])

    expect(mockDel).toHaveBeenCalledTimes(2)
  })
})

describe('resetDatabaseLimits', () => {
  it('should throw with a not-implemented message', async () => {
    await expect(
      resetDatabaseLimits(TEST_USER, ['database/datasets'])
    ).rejects.toThrow('not implemented')
  })
})

describe('resetAccountLimits', () => {
  it('should delete the account limit key via the redis pipeline', async () => {
    const { mockDel, mockExec } = mockRedisPipeline([1])

    await resetAccountLimits(TEST_USER, ['conversation'])

    expect(mockDel).toHaveBeenCalledWith(expect.stringContaining(TEST_USER.id))
    expect(mockExec).toHaveBeenCalled()
  })

  it('should delete one key per limit when multiple limits are given', async () => {
    const { mockDel } = mockRedisPipeline([1, 1])

    await resetAccountLimits(TEST_USER, ['conversation', 'message'])

    expect(mockDel).toHaveBeenCalledTimes(2)
  })
})

describe('specialRateLimitToValue', () => {
  it('should return 100 for special/rate/initiate', async () => {
    const value = await specialRateLimitToValue('free', 'special/rate/initiate')

    expect(value).toBe(100)
  })

  it('should return 100 regardless of plan', async () => {
    const freeValue = await specialRateLimitToValue(
      'free',
      'special/rate/initiate'
    )
    const proValue = await specialRateLimitToValue(
      'pro',
      'special/rate/initiate'
    )

    expect(freeValue).toBe(100)
    expect(proValue).toBe(100)
  })
})

describe('getUserLimits', () => {
  beforeEach(() => {
    userPlanMock().revealUserPlan.mockResolvedValue({
      plan: 'free',
      effectiveUser: TEST_USER,
    })
    jest.requireMock('@/lib/user.get').fastGetUserById.mockResolvedValue(null)
  })

  it('should return limits for the user plan', async () => {
    const result = await getUserLimits(TEST_USER)

    expect(result).toBeDefined()
    expect(typeof result).toBe('object')
    expect(userPlanMock().revealUserPlan).toHaveBeenCalledWith(TEST_USER)
  })

  it('should call revealUserPlan to determine the plan', async () => {
    await getUserLimits(TEST_USER)

    expect(userPlanMock().revealUserPlan).toHaveBeenCalledWith(TEST_USER)
  })

  it('should return the same result as getUserPlanLimits for the same plan', async () => {
    const limitsFromGet = await getUserLimits(TEST_USER)
    const limitsFromPlan = await getUserPlanLimits(TEST_USER, 'free')

    expect(limitsFromGet).toEqual(limitsFromPlan)
  })
})

describe('getExceededSpecialRateLimits', () => {
  beforeEach(() => {
    userPlanMock().revealUserPlan.mockResolvedValue({
      plan: 'free',
      effectiveUser: TEST_USER,
    })
    jest.requireMock('@/lib/user.get').fastGetUserById.mockResolvedValue(null)
  })

  it('should return empty array when session has no special rate id', async () => {
    jest
      .requireMock('@/lib/session.context')
      .getSafeSessionStore.mockReturnValue({})

    const exceeded = await getExceededSpecialRateLimits(TEST_USER, [
      'special/rate/initiate',
    ])

    expect(exceeded).toEqual([])
    expect(ratelimitMock().slidingWindow).not.toHaveBeenCalled()
  })

  it('should return empty array when session options are missing', async () => {
    jest
      .requireMock('@/lib/session.context')
      .getSafeSessionStore.mockReturnValue({ options: {} })

    const exceeded = await getExceededSpecialRateLimits(TEST_USER, [
      'special/rate/initiate',
    ])

    expect(exceeded).toEqual([])
    expect(ratelimitMock().slidingWindow).not.toHaveBeenCalled()
  })

  it('should check sliding window when session has special rate id', async () => {
    jest
      .requireMock('@/lib/session.context')
      .getSafeSessionStore.mockReturnValue({
        options: { limits: { special: { rate: { id: 'session-token-123' } } } },
      })
    ratelimitMock().slidingWindow.mockResolvedValue({ success: true })

    const exceeded = await getExceededSpecialRateLimits(TEST_USER, [
      'special/rate/initiate',
    ])

    expect(exceeded).toEqual([])
    expect(ratelimitMock().slidingWindow).toHaveBeenCalledTimes(1)
  })

  it('should return the limit when sliding window check fails', async () => {
    jest
      .requireMock('@/lib/session.context')
      .getSafeSessionStore.mockReturnValue({
        options: { limits: { special: { rate: { id: 'session-token-123' } } } },
      })
    ratelimitMock().slidingWindow.mockResolvedValue({ success: false })

    const exceeded = await getExceededSpecialRateLimits(TEST_USER, [
      'special/rate/initiate',
    ])

    expect(exceeded).toEqual(['special/rate/initiate'])
  })

  it('should include the special rate id in the cache key', async () => {
    const specialId = 'unique-session-id-abc'

    jest
      .requireMock('@/lib/session.context')
      .getSafeSessionStore.mockReturnValue({
        options: { limits: { special: { rate: { id: specialId } } } },
      })
    ratelimitMock().slidingWindow.mockResolvedValue({ success: true })

    await getExceededSpecialRateLimits(TEST_USER, ['special/rate/initiate'])

    const [key] = ratelimitMock().slidingWindow.mock.calls[0]

    expect(key).toContain(specialId)
  })

  it('should return empty array when limits array is empty', async () => {
    jest
      .requireMock('@/lib/session.context')
      .getSafeSessionStore.mockReturnValue({
        options: { limits: { special: { rate: { id: 'abc' } } } },
      })

    const exceeded = await getExceededSpecialRateLimits(TEST_USER, [])

    expect(exceeded).toEqual([])
    expect(ratelimitMock().slidingWindow).not.toHaveBeenCalled()
  })
})

describe('specialRateLimitsOk', () => {
  beforeEach(() => {
    userPlanMock().revealUserPlan.mockResolvedValue({
      plan: 'free',
      effectiveUser: TEST_USER,
    })
    jest.requireMock('@/lib/user.get').fastGetUserById.mockResolvedValue(null)
    jest
      .requireMock('@/lib/session.context')
      .getSafeSessionStore.mockReturnValue({
        options: { limits: { special: { rate: { id: 'test-session-id' } } } },
      })
  })

  it('should return true when special rate limit passes', async () => {
    ratelimitMock().slidingWindow.mockResolvedValue({ success: true })

    const ok = await specialRateLimitsOk(TEST_USER, ['special/rate/initiate'])

    expect(ok).toBe(true)
  })

  it('should return false when special rate limit is exceeded', async () => {
    ratelimitMock().slidingWindow.mockResolvedValue({ success: false })

    const ok = await specialRateLimitsOk(TEST_USER, ['special/rate/initiate'])

    expect(ok).toBe(false)
  })

  it('should return true when session has no special rate id (limits skipped)', async () => {
    jest
      .requireMock('@/lib/session.context')
      .getSafeSessionStore.mockReturnValue({})

    const ok = await specialRateLimitsOk(TEST_USER, ['special/rate/initiate'])

    expect(ok).toBe(true)
    expect(ratelimitMock().slidingWindow).not.toHaveBeenCalled()
  })

  it('should populate context with exceeded limits when a limit fails', async () => {
    ratelimitMock().slidingWindow.mockResolvedValue({ success: false })

    const context = { exceededLimits: [] }
    const ok = await specialRateLimitsOk(
      TEST_USER,
      ['special/rate/initiate'],
      context
    )

    expect(ok).toBe(false)
    expect(context.exceededLimits).toContain('special/rate/initiate')
  })

  it('should return true immediately when SKIP_LIMITS_CHECK is set', async () => {
    process.env.SKIP_LIMITS_CHECK = '1'
    ratelimitMock().slidingWindow.mockResolvedValue({ success: false })

    const ok = await specialRateLimitsOk(TEST_USER, ['special/rate/initiate'])

    expect(ok).toBe(true)
    expect(ratelimitMock().slidingWindow).not.toHaveBeenCalled()
  })
})

describe('checkLimits', () => {
  const sessionMock = () =>
    jest.requireMock('@/lib/session.context').getSafeSessionStore

  beforeEach(() => {
    userPlanMock().revealUserPlan.mockResolvedValue({
      plan: 'free',
      effectiveUser: TEST_USER,
    })
    jest.requireMock('@/lib/user.get').fastGetUserById.mockResolvedValue(null)
    sessionMock().mockReturnValue({})
  })

  it('should resolve without throwing when no limits are provided', async () => {
    await expect(checkLimits([], TEST_USER)).resolves.toBeUndefined()
  })

  it('should resolve without throwing when rate limits pass', async () => {
    ratelimitMock().slidingWindow.mockResolvedValue({ success: true })

    await expect(
      checkLimits(['rate/conversation'], TEST_USER)
    ).resolves.toBeUndefined()
  })

  it('should throw when rate limits are exceeded', async () => {
    ratelimitMock().slidingWindow.mockResolvedValue({ success: false })

    await expect(
      checkLimits(['rate/conversation'], TEST_USER)
    ).rejects.toThrow()

    expect(
      jest.requireMock('@/lib/response').throwLimitsReached
    ).toHaveBeenCalled()
  })

  it('should throw with a rate limit message when rate limit is exceeded', async () => {
    ratelimitMock().slidingWindow.mockResolvedValue({ success: false })

    await expect(checkLimits(['rate/conversation'], TEST_USER)).rejects.toThrow(
      /rate/
    )
  })

  it('should throw when account limits are exceeded', async () => {
    // Free plan conversation limit is 100; mock usage at 100
    mockRedisPipeline([100])

    await expect(checkLimits(['conversation'], TEST_USER)).rejects.toThrow()

    expect(
      jest.requireMock('@/lib/response').throwLimitsReached
    ).toHaveBeenCalled()
  })

  it('should throw with an account limit message when account limit is exceeded', async () => {
    mockRedisPipeline([100])

    await expect(checkLimits(['conversation'], TEST_USER)).rejects.toThrow(
      /account/i
    )
  })

  it('should resolve when account limits are below the plan limit', async () => {
    // Usage at 0, far below the free plan limit of 100 conversations
    mockRedisPipeline([0])

    await expect(
      checkLimits(['conversation'], TEST_USER)
    ).resolves.toBeUndefined()
  })

  it('should resolve when special rate limits are skipped (no session id)', async () => {
    // No special rate id in session -> limits are skipped -> should pass
    sessionMock().mockReturnValue({})

    await expect(
      checkLimits(['special/rate/initiate'], TEST_USER)
    ).resolves.toBeUndefined()
  })

  it('should throw when special rate limits are exceeded', async () => {
    sessionMock().mockReturnValue({
      options: { limits: { special: { rate: { id: 'abc' } } } },
    })
    ratelimitMock().slidingWindow.mockResolvedValue({ success: false })

    await expect(
      checkLimits(['special/rate/initiate'], TEST_USER)
    ).rejects.toThrow()
  })

  it('should check multiple limit types in a single call', async () => {
    // Rate limit passes, account limit passes (usage=0)
    ratelimitMock().slidingWindow.mockResolvedValue({ success: true })
    mockRedisPipeline([0])

    await expect(
      checkLimits(['rate/conversation', 'conversation'], TEST_USER)
    ).resolves.toBeUndefined()

    expect(ratelimitMock().slidingWindow).toHaveBeenCalled()
  })

  it('should stop and throw on the first exceeded limit type', async () => {
    // Rate limit fails immediately - account limit should still be checked
    // because tasks run concurrently, but the error is thrown on first failure
    ratelimitMock().slidingWindow.mockResolvedValue({ success: false })

    await expect(
      checkLimits(['rate/conversation', 'conversation'], TEST_USER)
    ).rejects.toThrow()
  })
})

describe('resolveOverrideLimits', () => {
  it('returns an empty object when there is no entry', () => {
    expect(resolveOverrideLimits(undefined, 'proPlus')).toEqual({})
  })

  it('returns the unconditional limits regardless of plan', () => {
    const entry = { limits: { database: { files: 300 } } }

    expect(resolveOverrideLimits(entry, 'proPlus')).toEqual({
      database: { files: 300 },
    })
    expect(resolveOverrideLimits(entry, 'pro')).toEqual({
      database: { files: 300 },
    })
  })

  it('applies plan-specific limits only when the plan matches', () => {
    const entry = {
      plans: {
        proPlus: { limits: { tokens: 5_000_000 } },
      },
    }

    expect(resolveOverrideLimits(entry, 'proPlus')).toEqual({
      tokens: 5_000_000,
    })

    // not on proPlus -> the exception must not apply
    expect(resolveOverrideLimits(entry, 'pro')).toEqual({})
    expect(resolveOverrideLimits(entry, 'scale')).toEqual({})
  })

  it('merges unconditional and plan-specific limits, with plan-specific winning', () => {
    const entry = {
      limits: {
        tokens: 1_000_000,
        database: { files: 300 },
      },
      plans: {
        proPlus: { limits: { tokens: 5_000_000 } },
      },
    }

    expect(resolveOverrideLimits(entry, 'proPlus')).toEqual({
      tokens: 5_000_000,
      database: { files: 300 },
    })

    expect(resolveOverrideLimits(entry, 'pro')).toEqual({
      tokens: 1_000_000,
      database: { files: 300 },
    })
  })
})

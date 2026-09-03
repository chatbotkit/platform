/**
 * @jest-environment node
 */
import { mockDeep } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { blockBot, getBotBlock } from '@/lib/bot.block'
import memcache from '@/lib/memcache'
import { notifyUsagePolicyTriggered } from '@/lib/notify'
import {
  evaluateUsagePolicies,
  resetUsagePolicyCounter,
} from '@/lib/usage.policy'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/memcache', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/bot.block', () => ({
  blockBot: jest.fn(),
  getBotBlock: jest.fn(),
}))

jest.mock('@/lib/notify', () => ({
  notifyUsagePolicyTriggered: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureException: jest.fn(),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => {
    const debugObj = { log: jest.fn(() => debugObj) }

    return debugObj
  }),
}))

const blockPolicy = {
  id: 'policy-block',
  config: {
    metric: 'tokens',
    threshold: 1000,
    windowInSeconds: 600,
    actions: { block: { durationInSeconds: 600 } },
  },
}

describe('evaluateUsagePolicies', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // counter increment returns the post-increment value
    memcache.incrementInWindow.mockResolvedValue(0)
    // notified marker set: first time in window
    memcache.set.mockResolvedValue('OK')
    // remaining window seconds; 0 means "unknown / already reset" so the block
    // falls back to its configured duration
    memcache.ttl.mockResolvedValue(0)
    // by default the bot is not already blocked
    getBotBlock.mockResolvedValue(null)

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
    })

    // by default the bot has no blueprint so only bot-scoped and global
    // policies are in scope
    prisma.bot.findUnique.mockResolvedValue({ blueprintId: null })
  })

  it('skips non-policy base types without querying', async () => {
    await evaluateUsagePolicies({
      userId: 'user-1',
      botId: 'bot-1',
      baseType: 'image',
      amount: 5,
    })

    expect(prisma.policy.findMany).not.toHaveBeenCalled()
  })

  it('skips when there is no botId', async () => {
    await evaluateUsagePolicies({
      userId: 'user-1',
      botId: '',
      baseType: 'token',
      amount: 5,
    })

    expect(prisma.policy.findMany).not.toHaveBeenCalled()
  })

  it('queries the bot-scoped and global usage policies for a bot with no blueprint', async () => {
    prisma.bot.findUnique.mockResolvedValue({ blueprintId: null })
    prisma.policy.findMany.mockResolvedValue([])

    await evaluateUsagePolicies({
      userId: 'user-1',
      botId: 'bot-1',
      baseType: 'token',
      amount: 5,
    })

    expect(prisma.bot.findUnique).toHaveBeenCalledWith({
      where: { id: 'bot-1' },
      select: { blueprintId: true },
    })
    expect(prisma.policy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          type: 'usage',
          state: { not: 'disabled' },
          OR: [{ botId: 'bot-1' }, { botId: null, blueprintId: null }],
        },
      })
    )
  })

  it('also queries blueprint-scoped policies when the bot is linked to a blueprint', async () => {
    prisma.bot.findUnique.mockResolvedValue({ blueprintId: 'bp-1' })
    prisma.policy.findMany.mockResolvedValue([])

    await evaluateUsagePolicies({
      userId: 'user-1',
      botId: 'bot-1',
      baseType: 'token',
      amount: 5,
    })

    expect(prisma.policy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          type: 'usage',
          state: { not: 'disabled' },
          OR: [
            { botId: 'bot-1' },
            { botId: null, blueprintId: null },
            { botId: null, blueprintId: 'bp-1' },
          ],
        },
      })
    )
  })

  it('does nothing while under the threshold', async () => {
    prisma.policy.findMany.mockResolvedValue([blockPolicy])
    memcache.incrementInWindow.mockResolvedValue(999)

    await evaluateUsagePolicies({
      userId: 'user-1',
      botId: 'bot-1',
      baseType: 'token',
      amount: 999,
    })

    expect(blockBot).not.toHaveBeenCalled()
    expect(notifyUsagePolicyTriggered).not.toHaveBeenCalled()
  })

  it('blocks the bot when the threshold is crossed', async () => {
    prisma.policy.findMany.mockResolvedValue([blockPolicy])
    memcache.incrementInWindow.mockResolvedValue(1000)

    await evaluateUsagePolicies({
      userId: 'user-1',
      botId: 'bot-1',
      baseType: 'token',
      amount: 1000,
    })

    expect(blockBot).toHaveBeenCalledWith('bot-1', {
      reason: expect.any(String),
      durationInSeconds: 600,
      policyId: 'policy-block',
    })
  })

  it('extends the block to the remaining window when the window outlasts the configured block', async () => {
    // configured block is 10min but the token window still has 1h left; the
    // block must run to the end of the window so it does not lift while the
    // counter is still over threshold and immediately re-block
    prisma.policy.findMany.mockResolvedValue([blockPolicy])
    memcache.incrementInWindow.mockResolvedValue(1000)
    memcache.ttl.mockResolvedValue(3600)

    await evaluateUsagePolicies({
      userId: 'user-1',
      botId: 'bot-1',
      baseType: 'token',
      amount: 1000,
    })

    expect(memcache.ttl).toHaveBeenCalledWith('usage-policy-policy-block')
    expect(blockBot).toHaveBeenCalledWith('bot-1', {
      reason: expect.any(String),
      durationInSeconds: 3600,
      policyId: 'policy-block',
    })
  })

  it('does not re-block a bot that is already blocked (suppress self-re-block)', async () => {
    // an active block already runs until the window resets; re-arming on every
    // subsequent over-threshold event would keep pushing the lift time out
    prisma.policy.findMany.mockResolvedValue([blockPolicy])
    memcache.incrementInWindow.mockResolvedValue(1000)
    getBotBlock.mockResolvedValue({
      reason: 'This bot has been temporarily disabled by a usage policy.',
      policyId: 'policy-block',
      ttl: 500,
    })

    await evaluateUsagePolicies({
      userId: 'user-1',
      botId: 'bot-1',
      baseType: 'token',
      amount: 1000,
    })

    expect(blockBot).not.toHaveBeenCalled()
  })

  it('skips a policy whose metric does not match the recorded usage', async () => {
    prisma.policy.findMany.mockResolvedValue([
      {
        id: 'policy-messages',
        config: {
          metric: 'messages',
          threshold: 1,
          windowInSeconds: 600,
          actions: { block: { durationInSeconds: 600 } },
        },
      },
    ])
    memcache.incrementInWindow.mockResolvedValue(10)

    await evaluateUsagePolicies({
      userId: 'user-1',
      botId: 'bot-1',
      baseType: 'token',
      amount: 10,
    })

    expect(memcache.incrementInWindow).not.toHaveBeenCalled()
    expect(blockBot).not.toHaveBeenCalled()
  })

  describe('email action', () => {
    const emailPolicy = {
      id: 'policy-email',
      config: {
        metric: 'tokens',
        threshold: 100,
        windowInSeconds: 600,
        actions: { email: {} },
      },
    }

    it('notifies the owner once per window when no recipients are configured', async () => {
      prisma.policy.findMany.mockResolvedValue([emailPolicy])
      memcache.incrementInWindow.mockResolvedValue(100)

      await evaluateUsagePolicies({
        userId: 'user-1',
        botId: 'bot-1',
        baseType: 'token',
        amount: 100,
      })

      expect(memcache.set).toHaveBeenCalledWith(
        'usage-policy-notified-policy-email',
        '1',
        { nx: true, ex: 600 }
      )
      expect(notifyUsagePolicyTriggered).toHaveBeenCalledWith(
        [{ id: 'user-1', email: 'owner@example.com' }],
        expect.objectContaining({ botId: 'bot-1', metric: 'tokens' })
      )
    })

    it('releases the notify window when the fresh policy resolves no recipients', async () => {
      // owner-targeted email but the owner has no address → zero recipients
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', email: null })
      prisma.policy.findMany.mockResolvedValue([emailPolicy])
      memcache.incrementInWindow.mockResolvedValue(100)

      await evaluateUsagePolicies({
        userId: 'user-1',
        botId: 'bot-1',
        baseType: 'token',
        amount: 100,
      })

      // the dedupe key must be released so a later-resolvable recipient is not
      // suppressed for the rest of the window
      expect(memcache.del).toHaveBeenCalledWith(
        'usage-policy-notified-policy-email'
      )
      expect(notifyUsagePolicyTriggered).not.toHaveBeenCalled()
    })

    it('notifies the configured recipients instead of the owner', async () => {
      prisma.policy.findMany.mockResolvedValue([
        {
          id: 'policy-email-to',
          config: {
            metric: 'tokens',
            threshold: 100,
            windowInSeconds: 600,
            actions: { email: { to: ['a@example.com', 'b@example.com'] } },
          },
        },
      ])
      memcache.incrementInWindow.mockResolvedValue(100)

      await evaluateUsagePolicies({
        userId: 'user-1',
        botId: 'bot-1',
        baseType: 'token',
        amount: 100,
      })

      expect(prisma.user.findUnique).not.toHaveBeenCalled()
      expect(notifyUsagePolicyTriggered).toHaveBeenCalledWith(
        [
          { id: 'user-1', email: 'a@example.com' },
          { id: 'user-1', email: 'b@example.com' },
        ],
        expect.anything()
      )
    })

    it('notifies a single recipient configured as a string', async () => {
      prisma.policy.findMany.mockResolvedValue([
        {
          id: 'policy-email-string',
          config: {
            metric: 'tokens',
            threshold: 100,
            windowInSeconds: 600,
            actions: { email: 'a@example.com' },
          },
        },
      ])
      memcache.incrementInWindow.mockResolvedValue(100)

      await evaluateUsagePolicies({
        userId: 'user-1',
        botId: 'bot-1',
        baseType: 'token',
        amount: 100,
      })

      expect(prisma.user.findUnique).not.toHaveBeenCalled()
      expect(notifyUsagePolicyTriggered).toHaveBeenCalledWith(
        [{ id: 'user-1', email: 'a@example.com' }],
        expect.anything()
      )
    })

    it('notifies recipients configured as an array', async () => {
      prisma.policy.findMany.mockResolvedValue([
        {
          id: 'policy-email-array',
          config: {
            metric: 'tokens',
            threshold: 100,
            windowInSeconds: 600,
            actions: { email: ['a@example.com', 'b@example.com'] },
          },
        },
      ])
      memcache.incrementInWindow.mockResolvedValue(100)

      await evaluateUsagePolicies({
        userId: 'user-1',
        botId: 'bot-1',
        baseType: 'token',
        amount: 100,
      })

      expect(prisma.user.findUnique).not.toHaveBeenCalled()
      expect(notifyUsagePolicyTriggered).toHaveBeenCalledWith(
        [
          { id: 'user-1', email: 'a@example.com' },
          { id: 'user-1', email: 'b@example.com' },
        ],
        expect.anything()
      )
    })

    it('notifies a recipient configured as object to string', async () => {
      prisma.policy.findMany.mockResolvedValue([
        {
          id: 'policy-email-object-string',
          config: {
            metric: 'tokens',
            threshold: 100,
            windowInSeconds: 600,
            actions: { email: { to: 'a@example.com' } },
          },
        },
      ])
      memcache.incrementInWindow.mockResolvedValue(100)

      await evaluateUsagePolicies({
        userId: 'user-1',
        botId: 'bot-1',
        baseType: 'token',
        amount: 100,
      })

      expect(prisma.user.findUnique).not.toHaveBeenCalled()
      expect(notifyUsagePolicyTriggered).toHaveBeenCalledWith(
        [{ id: 'user-1', email: 'a@example.com' }],
        expect.anything()
      )
    })

    it('does not email again within the same window (dedup)', async () => {
      prisma.policy.findMany.mockResolvedValue([emailPolicy])
      memcache.incrementInWindow.mockResolvedValue(100)
      memcache.set.mockResolvedValue(null) // marker already set

      await evaluateUsagePolicies({
        userId: 'user-1',
        botId: 'bot-1',
        baseType: 'token',
        amount: 100,
      })

      expect(notifyUsagePolicyTriggered).not.toHaveBeenCalled()
    })
  })

  describe('cascading / merged actions', () => {
    it('blocks once with the longest duration when several block policies trip', async () => {
      prisma.policy.findMany.mockResolvedValue([
        {
          id: 'policy-short',
          config: {
            metric: 'tokens',
            threshold: 100,
            windowInSeconds: 600,
            actions: { block: { durationInSeconds: 600 } },
          },
        },
        {
          id: 'policy-long',
          config: {
            metric: 'tokens',
            threshold: 100,
            windowInSeconds: 600,
            actions: { block: { durationInSeconds: 1800 } },
          },
        },
      ])
      memcache.incrementInWindow.mockResolvedValue(100)

      await evaluateUsagePolicies({
        userId: 'user-1',
        botId: 'bot-1',
        baseType: 'token',
        amount: 100,
      })

      expect(blockBot).toHaveBeenCalledTimes(1)
      expect(blockBot).toHaveBeenCalledWith('bot-1', {
        reason: expect.any(String),
        durationInSeconds: 1800,
        policyId: 'policy-long',
      })
    })

    it('sends a single email to the union of recipients across tripped policies', async () => {
      prisma.policy.findMany.mockResolvedValue([
        {
          id: 'policy-a',
          config: {
            metric: 'tokens',
            threshold: 100,
            windowInSeconds: 600,
            actions: { email: { to: ['a@example.com', 'shared@example.com'] } },
          },
        },
        {
          id: 'policy-b',
          config: {
            metric: 'tokens',
            threshold: 50,
            windowInSeconds: 600,
            actions: { email: { to: ['b@example.com', 'shared@example.com'] } },
          },
        },
      ])
      memcache.incrementInWindow.mockResolvedValue(100)

      await evaluateUsagePolicies({
        userId: 'user-1',
        botId: 'bot-1',
        baseType: 'token',
        amount: 100,
      })

      expect(notifyUsagePolicyTriggered).toHaveBeenCalledTimes(1)
      expect(notifyUsagePolicyTriggered).toHaveBeenCalledWith(
        [
          { id: 'user-1', email: 'a@example.com' },
          { id: 'user-1', email: 'shared@example.com' },
          { id: 'user-1', email: 'b@example.com' },
        ],
        // the strictest (lowest) threshold is the binding one to report
        expect.objectContaining({ metric: 'tokens', threshold: 50 })
      )
    })

    it('only includes recipients of policies that are fresh in their window', async () => {
      prisma.policy.findMany.mockResolvedValue([
        {
          id: 'policy-a',
          config: {
            metric: 'tokens',
            threshold: 100,
            windowInSeconds: 600,
            actions: { email: { to: 'a@example.com' } },
          },
        },
        {
          id: 'policy-b',
          config: {
            metric: 'tokens',
            threshold: 100,
            windowInSeconds: 600,
            actions: { email: { to: 'b@example.com' } },
          },
        },
      ])
      memcache.incrementInWindow.mockResolvedValue(100)
      // policy-a already notified this window, policy-b is fresh
      memcache.set.mockResolvedValueOnce(null).mockResolvedValueOnce('OK')

      await evaluateUsagePolicies({
        userId: 'user-1',
        botId: 'bot-1',
        baseType: 'token',
        amount: 100,
      })

      expect(notifyUsagePolicyTriggered).toHaveBeenCalledTimes(1)
      expect(notifyUsagePolicyTriggered).toHaveBeenCalledWith(
        [{ id: 'user-1', email: 'b@example.com' }],
        expect.anything()
      )
    })

    it('reports the merged block in the email when a block-only and an email-only policy both trip', async () => {
      prisma.policy.findMany.mockResolvedValue([
        {
          id: 'policy-block-only',
          config: {
            metric: 'tokens',
            threshold: 100,
            windowInSeconds: 600,
            actions: { block: { durationInSeconds: 600 } },
          },
        },
        {
          id: 'policy-email-only',
          config: {
            metric: 'tokens',
            threshold: 100,
            windowInSeconds: 600,
            actions: { email: { to: 'b@example.com' } },
          },
        },
      ])
      memcache.incrementInWindow.mockResolvedValue(100)

      await evaluateUsagePolicies({
        userId: 'user-1',
        botId: 'bot-1',
        baseType: 'token',
        amount: 100,
      })

      expect(blockBot).toHaveBeenCalledTimes(1)
      expect(blockBot).toHaveBeenCalledWith('bot-1', {
        reason: expect.any(String),
        durationInSeconds: 600,
        policyId: 'policy-block-only',
      })
      expect(notifyUsagePolicyTriggered).toHaveBeenCalledTimes(1)
      expect(notifyUsagePolicyTriggered).toHaveBeenCalledWith(
        [{ id: 'user-1', email: 'b@example.com' }],
        expect.objectContaining({ blocked: true, blockMinutes: 10 })
      )
    })
  })

  it('never throws into the recording path', async () => {
    prisma.policy.findMany.mockRejectedValue(new Error('db down'))

    await expect(
      evaluateUsagePolicies({
        userId: 'user-1',
        botId: 'bot-1',
        baseType: 'token',
        amount: 10,
      })
    ).resolves.toBeUndefined()
  })

  it('never throws when the bot blueprint lookup fails', async () => {
    prisma.bot.findUnique.mockRejectedValue(new Error('db down'))

    await expect(
      evaluateUsagePolicies({
        userId: 'user-1',
        botId: 'bot-1',
        baseType: 'token',
        amount: 10,
      })
    ).resolves.toBeUndefined()

    expect(prisma.policy.findMany).not.toHaveBeenCalled()
  })
})

describe('resetUsagePolicyCounter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('clears the window counter and the notify-dedupe key', async () => {
    await resetUsagePolicyCounter('policy-1')

    expect(memcache.del).toHaveBeenCalledWith(
      'usage-policy-policy-1',
      'usage-policy-notified-policy-1'
    )
  })
})

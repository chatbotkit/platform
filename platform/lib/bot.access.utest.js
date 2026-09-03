import { BotVisibility } from '@/prisma/types'

import * as userRelation from '@/lib/user.relation'

import { canUseBot } from './bot.access'

jest.mock('@/lib/user.relation', () => ({
  getRelatedUsers: jest.fn(),
}))

const captureException = jest.fn()

jest.mock('@/lib/error', () => ({
  captureException: (...args) => captureException(...args),
}))

describe('canUseBot', () => {
  const userId = 'user-1'
  const otherUserId = 'user-2'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns true if user is the owner of the bot', async () => {
    const bot = { userId, visibility: BotVisibility.private }

    await expect(canUseBot(userId, bot)).resolves.toBe(true)
  })

  it('returns true if bot is public', async () => {
    const bot = { userId: otherUserId, visibility: BotVisibility.public }

    await expect(canUseBot(userId, bot)).resolves.toBe(true)
  })

  it('returns true if bot is protected and user is related', async () => {
    const bot = { userId: otherUserId, visibility: BotVisibility.protected }

    userRelation.getRelatedUsers.mockResolvedValue([{ id: otherUserId }])

    await expect(canUseBot(userId, bot)).resolves.toBe(true)
  })

  it('returns false if bot is protected and user is not related', async () => {
    const bot = { userId: otherUserId, visibility: BotVisibility.protected }

    userRelation.getRelatedUsers.mockResolvedValue([{ id: 'user-3' }])

    await expect(canUseBot(userId, bot)).resolves.toBe(false)
  })

  it('returns false if bot is private and not owned by user', async () => {
    const bot = { userId: otherUserId, visibility: BotVisibility.private }

    await expect(canUseBot(userId, bot)).resolves.toBe(false)
  })

  it('returns false if getRelatedUsers throws for protected bot', async () => {
    const bot = { userId: otherUserId, visibility: BotVisibility.protected }

    userRelation.getRelatedUsers.mockRejectedValue(new Error('fail'))

    await expect(canUseBot(userId, bot)).resolves.toBe(false)

    expect(captureException).toHaveBeenCalled()
  })

  it('returns false for unknown visibility', async () => {
    const bot = { userId: otherUserId, visibility: 'unknown' }

    await expect(canUseBot(userId, bot)).resolves.toBe(false)
  })
})

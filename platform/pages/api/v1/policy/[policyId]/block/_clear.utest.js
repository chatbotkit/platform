/**
 * @jest-environment node
 */
import handler from './clear'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      policy: {
        findUniqueByIdentifier: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/bot.block', () => ({
  getBotBlock: jest.fn(),
  getBotsBlockedByPolicy: jest.fn(),
  unblockBot: jest.fn(),
}))

jest.mock('@/lib/usage.policy', () => ({
  resetUsagePolicyCounter: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

describe('POST /api/v1/policy/[policyId]/block/clear', () => {
  const prisma = jest.requireMock('@/prisma/client').default
  const { getBotBlock, getBotsBlockedByPolicy, unblockBot } =
    jest.requireMock('@/lib/bot.block')
  const { resetUsagePolicyCounter } = jest.requireMock('@/lib/usage.policy')

  const mockSession = { user: { id: 'user_123' } }
  const mockReq = { query: { policyId: 'policy_abc' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('bot-scoped policy', () => {
    it('unblocks the targeted bot and resets the window when this policy tripped it', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        id: 'policy_abc',
        userId: 'user_123',
        botId: 'bot_1',
      })
      getBotBlock.mockResolvedValue({ policyId: 'policy_abc', ttl: 60 })

      const result = await handler(mockReq, mockSession)

      expect(unblockBot).toHaveBeenCalledWith('bot_1')
      expect(resetUsagePolicyCounter).toHaveBeenCalledWith('policy_abc')
      expect(result.body).toEqual({ cleared: 1 })
    })

    it('does not unblock a bot blocked by another policy but still resets the window', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        id: 'policy_abc',
        userId: 'user_123',
        botId: 'bot_1',
      })
      getBotBlock.mockResolvedValue({ policyId: 'other_policy' })

      const result = await handler(mockReq, mockSession)

      expect(unblockBot).not.toHaveBeenCalled()
      expect(resetUsagePolicyCounter).toHaveBeenCalledWith('policy_abc')
      expect(result.body).toEqual({ cleared: 0 })
    })
  })

  describe('global policy', () => {
    it('unblocks every bot the policy is blocking and resets the window', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        id: 'policy_abc',
        userId: 'user_123',
        botId: null,
      })
      getBotsBlockedByPolicy.mockResolvedValue(['bot_1', 'bot_2'])

      const result = await handler(mockReq, mockSession)

      expect(getBotsBlockedByPolicy).toHaveBeenCalledWith('policy_abc')
      expect(unblockBot).toHaveBeenCalledWith('bot_1')
      expect(unblockBot).toHaveBeenCalledWith('bot_2')
      expect(resetUsagePolicyCounter).toHaveBeenCalledWith('policy_abc')
      expect(result.body).toEqual({ cleared: 2 })
    })
  })

  describe('authorization', () => {
    it('returns 404 and clears nothing when the policy is not found', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(404)
      expect(unblockBot).not.toHaveBeenCalled()
      expect(resetUsagePolicyCounter).not.toHaveBeenCalled()
    })

    it('returns 403 and clears nothing when the user does not own the policy', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        id: 'policy_abc',
        userId: 'other_user',
        botId: 'bot_1',
      })

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(403)
      expect(unblockBot).not.toHaveBeenCalled()
      expect(resetUsagePolicyCounter).not.toHaveBeenCalled()
    })
  })
})

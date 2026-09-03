/**
 * @jest-environment node
 */
import handler from './list'

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
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
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

describe('GET /api/v1/policy/[policyId]/block/list', () => {
  const prisma = jest.requireMock('@/prisma/client').default
  const { getBotBlock, getBotsBlockedByPolicy } =
    jest.requireMock('@/lib/bot.block')

  const mockSession = { user: { id: 'user_123' } }
  const mockReq = { query: { policyId: 'policy_abc' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('bot-scoped policy', () => {
    it('reports the targeted bot when this policy tripped its block', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        id: 'policy_abc',
        userId: 'user_123',
        botId: 'bot_1',
      })
      getBotBlock.mockResolvedValue({
        reason: 'blocked',
        policyId: 'policy_abc',
        ttl: 120,
      })

      const result = await handler(mockReq, mockSession)

      expect(getBotBlock).toHaveBeenCalledWith('bot_1')
      expect(getBotsBlockedByPolicy).not.toHaveBeenCalled()
      expect(result.body).toEqual({
        scope: 'bot',
        botId: 'bot_1',
        block: { reason: 'blocked', policyId: 'policy_abc', ttl: 120 },
        blockedBotIds: ['bot_1'],
      })
    })

    it('does not attribute a block tripped by another policy', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        id: 'policy_abc',
        userId: 'user_123',
        botId: 'bot_1',
      })
      getBotBlock.mockResolvedValue({ policyId: 'other_policy', ttl: 60 })

      const result = await handler(mockReq, mockSession)

      expect(result.body).toEqual({
        scope: 'bot',
        botId: 'bot_1',
        block: null,
        blockedBotIds: [],
      })
    })
  })

  describe('global policy', () => {
    it('scans for every bot the policy is blocking', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        id: 'policy_abc',
        userId: 'user_123',
        botId: null,
      })
      getBotsBlockedByPolicy.mockResolvedValue(['bot_1', 'bot_2'])

      const result = await handler(mockReq, mockSession)

      expect(getBotsBlockedByPolicy).toHaveBeenCalledWith('policy_abc')
      expect(getBotBlock).not.toHaveBeenCalled()
      expect(result.body).toEqual({
        scope: 'global',
        botId: null,
        block: null,
        blockedBotIds: ['bot_1', 'bot_2'],
      })
    })
  })

  describe('authorization', () => {
    it('returns 404 when the policy is not found', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(404)
    })

    it('returns 403 when the user does not own the policy', async () => {
      prisma.policy.findUniqueByIdentifier.mockResolvedValue({
        id: 'policy_abc',
        userId: 'other_user',
        botId: 'bot_1',
      })

      const result = await handler(mockReq, mockSession)

      expect(result.status).toBe(403)
      expect(getBotBlock).not.toHaveBeenCalled()
    })
  })
})

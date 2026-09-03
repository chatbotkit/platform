/**
 * @jest-environment node
 */
import handler from './create'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      context: {
        create: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/user.handler', () => ({
  withChildUserSession: (fn) => (req, session, body) => fn(req, session, body),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

describe('POST /api/v1/user/[userId]/context/create', () => {
  const prisma = jest.requireMock('@/prisma/client').default

  const mockSession = {
    user: { id: 'child_user_1' },
  }

  const mockContext = {
    id: 'ctx_abc',
    name: 'Onboarding Context',
    description: 'Links the customer to the onboarding bot',
    blueprintId: 'blueprint_xyz',
    botId: 'bot_123',
    datasetId: null,
    skillsetId: null,
    payload: { tier: 'premium' },
    meta: { source: 'user' },
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-06-01'),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should create context with all provided fields and return the record', async () => {
      prisma.context.create.mockResolvedValue({ ...mockContext })

      const body = {
        name: 'Onboarding Context',
        description: 'Links the customer to the onboarding bot',
        blueprintId: 'blueprint_xyz',
        botId: 'bot_123',
        payload: { tier: 'premium' },
        meta: { source: 'user' },
      }

      const result = await handler({}, mockSession, body)

      expect(prisma.context.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'child_user_1',
            name: 'Onboarding Context',
            description: 'Links the customer to the onboarding bot',
            blueprintId: 'blueprint_xyz',
            botId: 'bot_123',
            payload: { tier: 'premium' },
            meta: { source: 'user' },
          }),
        })
      )

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('ctx_abc')
      expect(result.body.botId).toBe('bot_123')
    })

    it('should use child session userId for the context owner', async () => {
      prisma.context.create.mockResolvedValue({ ...mockContext })

      await handler({}, { user: { id: 'child_user_42' } }, {})

      expect(prisma.context.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'child_user_42',
          }),
        })
      )
    })

    it('should prefer blueprintId.id when blueprint is provided as an object', async () => {
      prisma.context.create.mockResolvedValue({
        ...mockContext,
        blueprintId: 'bp_nested',
      })

      const body = { blueprintId: { id: 'bp_nested' } }

      await handler({}, mockSession, body)

      expect(prisma.context.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blueprintId: 'bp_nested',
          }),
        })
      )
    })

    it('should prefer botId.id when bot is provided as an object', async () => {
      prisma.context.create.mockResolvedValue({
        ...mockContext,
        botId: 'bot_nested',
      })

      const body = { botId: { id: 'bot_nested' } }

      await handler({}, mockSession, body)

      expect(prisma.context.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            botId: 'bot_nested',
          }),
        })
      )
    })

    it('should pass payload through unchanged', async () => {
      const payload = {
        tier: 'enterprise',
        locale: 'de-DE',
        featureFlags: ['a', 'b'],
      }

      prisma.context.create.mockResolvedValue({ ...mockContext, payload })

      await handler({}, mockSession, { payload })

      expect(prisma.context.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ payload }),
        })
      )
    })

    it('should include expected fields in the select clause', async () => {
      prisma.context.create.mockResolvedValue({ ...mockContext })

      await handler({}, mockSession, {})

      expect(prisma.context.create).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            name: true,
            description: true,
            blueprintId: true,
            botId: true,
            datasetId: true,
            skillsetId: true,
            payload: true,
            meta: true,
            createdAt: true,
            updatedAt: true,
          }),
        })
      )
    })
  })

  describe('error handling', () => {
    it('should propagate database creation errors', async () => {
      prisma.context.create.mockRejectedValue(new Error('DB write failed'))

      await expect(handler({}, mockSession, {})).rejects.toThrow(
        'DB write failed'
      )
    })
  })
})

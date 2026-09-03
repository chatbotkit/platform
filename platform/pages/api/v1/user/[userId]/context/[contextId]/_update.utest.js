/**
 * @jest-environment node
 */
import handler from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      context: {
        findUniqueByIdentifier: jest.fn(),
        update: jest.fn(),
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

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((nextMeta, currentMeta) => ({
    ...currentMeta,
    ...nextMeta,
  })),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/user.handler', () => ({
  withChildUserSession: (fn) => (req, session, body) => fn(req, session, body),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

describe('POST /api/v1/user/[userId]/context/[contextId]/update', () => {
  const prismaClient = jest.requireMock('@/prisma/client').default
  const { getMeta } = jest.requireMock('@/lib/meta')

  const mockSession = {
    user: { id: 'child_user_1' },
  }

  const mockReq = {
    query: { contextId: 'ctx_abc' },
  }

  const mockContext = {
    id: 'ctx_abc',
    userId: 'child_user_1',
    meta: { existing: true },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('should update context and return its id', async () => {
      prismaClient.context.findUniqueByIdentifier.mockResolvedValue({
        ...mockContext,
      })
      prismaClient.context.update.mockResolvedValue({})

      const body = { name: 'Updated Context', description: 'New description' }
      const result = await handler(mockReq, mockSession, body)

      expect(prismaClient.context.update).toHaveBeenCalledWith({
        where: { id: 'ctx_abc' },
        data: expect.objectContaining({
          name: 'Updated Context',
          description: 'New description',
        }),
      })
      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'ctx_abc' })
    })

    it('should accept blueprintId as a plain string', async () => {
      prismaClient.context.findUniqueByIdentifier.mockResolvedValue({
        ...mockContext,
      })
      prismaClient.context.update.mockResolvedValue({})

      const body = { blueprintId: 'blueprint_str_ref' }

      await handler(mockReq, mockSession, body)

      expect(prismaClient.context.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ blueprintId: 'blueprint_str_ref' }),
        })
      )
    })

    it('should extract blueprintId from an object reference', async () => {
      // @note the API accepts either a raw string ID or an {id: string} object
      // to allow callers to pass full resource objects without ID extraction
      prismaClient.context.findUniqueByIdentifier.mockResolvedValue({
        ...mockContext,
      })
      prismaClient.context.update.mockResolvedValue({})

      const body = { blueprintId: { id: 'blueprint_from_obj' } }

      await handler(mockReq, mockSession, body)

      expect(prismaClient.context.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ blueprintId: 'blueprint_from_obj' }),
        })
      )
    })

    it('should extract botId from an object reference', async () => {
      prismaClient.context.findUniqueByIdentifier.mockResolvedValue({
        ...mockContext,
      })
      prismaClient.context.update.mockResolvedValue({})

      const body = { botId: { id: 'bot_from_obj' } }

      await handler(mockReq, mockSession, body)

      expect(prismaClient.context.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ botId: 'bot_from_obj' }),
        })
      )
    })

    it('should merge meta using getMeta', async () => {
      prismaClient.context.findUniqueByIdentifier.mockResolvedValue({
        ...mockContext,
      })
      prismaClient.context.update.mockResolvedValue({})

      const body = { meta: { newKey: 'value' } }

      await handler(mockReq, mockSession, body)

      expect(getMeta).toHaveBeenCalledWith(
        { newKey: 'value' },
        { existing: true }
      )
    })

    it('should pass payload through unchanged', async () => {
      prismaClient.context.findUniqueByIdentifier.mockResolvedValue({
        ...mockContext,
      })
      prismaClient.context.update.mockResolvedValue({})

      const body = { payload: { tier: 'enterprise', locale: 'en-US' } }

      await handler(mockReq, mockSession, body)

      expect(prismaClient.context.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payload: { tier: 'enterprise', locale: 'en-US' },
          }),
        })
      )
    })
  })

  describe('authorization', () => {
    it('should return 404 and not update when context is not found', async () => {
      prismaClient.context.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(404)
      expect(prismaClient.context.update).not.toHaveBeenCalled()
    })

    it('should return 403 and not update when context belongs to a different user', async () => {
      // @note cross-user mutation must be rejected - the child session scopes
      // access to contexts owned by that specific child user only
      prismaClient.context.findUniqueByIdentifier.mockResolvedValue({
        ...mockContext,
        userId: 'other_child_user_999',
      })

      const result = await handler(mockReq, mockSession, {})

      expect(result.status).toBe(403)
      expect(prismaClient.context.update).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should propagate database lookup errors without updating', async () => {
      prismaClient.context.findUniqueByIdentifier.mockRejectedValue(
        new Error('lookup failed')
      )

      await expect(handler(mockReq, mockSession, {})).rejects.toThrow(
        'lookup failed'
      )
      expect(prismaClient.context.update).not.toHaveBeenCalled()
    })
  })
})

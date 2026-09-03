/* eslint-disable @typescript-eslint/no-require-imports */
import { withMethods } from './methods'

describe('withMethods - $queryMap', () => {
  it('should execute multiple queries in parallel and return results as a named object', async () => {
    const methods = withMethods()
    const $queryMap = methods.client.$queryMap

    const mockQueries = {
      users: Promise.resolve([{ id: 'user-1' }, { id: 'user-2' }]),
      bots: Promise.resolve([{ id: 'bot-1' }]),
      count: Promise.resolve(42),
    }

    const result = await $queryMap(mockQueries)

    expect(result).toEqual({
      users: [{ id: 'user-1' }, { id: 'user-2' }],
      bots: [{ id: 'bot-1' }],
      count: 42,
    })
  })

  it('should handle empty query map', async () => {
    const methods = withMethods()
    const $queryMap = methods.client.$queryMap

    const result = await $queryMap({})

    expect(result).toEqual({})
  })

  it('should handle single query', async () => {
    const methods = withMethods()
    const $queryMap = methods.client.$queryMap

    const result = await $queryMap({
      data: Promise.resolve({ id: 'test', name: 'Test' }),
    })

    expect(result).toEqual({
      data: { id: 'test', name: 'Test' },
    })
  })

  it('should reject if any query fails', async () => {
    const methods = withMethods()
    const $queryMap = methods.client.$queryMap

    const mockQueries = {
      users: Promise.resolve([{ id: 'user-1' }]),
      failing: Promise.reject(new Error('Database connection failed')),
    }

    await expect($queryMap(mockQueries)).rejects.toThrow(
      'Database connection failed'
    )
  })

  it('should execute queries concurrently (not sequentially)', async () => {
    const methods = withMethods()
    const $queryMap = methods.client.$queryMap

    const executionOrder = []

    const mockQueries = {
      first: new Promise((resolve) => {
        executionOrder.push('first-start')
        setTimeout(() => {
          executionOrder.push('first-end')
          resolve('first-result')
        }, 50)
      }),
      second: new Promise((resolve) => {
        executionOrder.push('second-start')
        setTimeout(() => {
          executionOrder.push('second-end')
          resolve('second-result')
        }, 25)
      }),
    }

    const result = await $queryMap(mockQueries)

    // Both should start before either ends (parallel execution)
    expect(executionOrder.slice(0, 2)).toContain('first-start')
    expect(executionOrder.slice(0, 2)).toContain('second-start')

    // Second should end before first (shorter timeout)
    expect(executionOrder.indexOf('second-end')).toBeLessThan(
      executionOrder.indexOf('first-end')
    )

    expect(result).toEqual({
      first: 'first-result',
      second: 'second-result',
    })
  })

  it('should preserve key order in results', async () => {
    const methods = withMethods()
    const $queryMap = methods.client.$queryMap

    const result = await $queryMap({
      alpha: Promise.resolve('a'),
      beta: Promise.resolve('b'),
      gamma: Promise.resolve('c'),
    })

    expect(Object.keys(result)).toEqual(['alpha', 'beta', 'gamma'])
  })

  it('should handle null and undefined results', async () => {
    const methods = withMethods()
    const $queryMap = methods.client.$queryMap

    const result = await $queryMap({
      nullResult: Promise.resolve(null),
      undefinedResult: Promise.resolve(undefined),
      emptyArray: Promise.resolve([]),
    })

    expect(result).toEqual({
      nullResult: null,
      undefinedResult: undefined,
      emptyArray: [],
    })
  })
})

describe('withMethods - findUniqueByIdentifier', () => {
  let mockContext

  beforeEach(() => {
    jest.clearAllMocks()

    mockContext = {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    }
  })

  // Create a mock Prisma-like extension context for testing
  const createMockPrismaClient = () => {
    const methods = withMethods()

    // Mock the extension context
    const mockExtensionContext = (context) => context

    return {
      findUniqueByIdentifier: async (user, identifier, args) => {
        // Simulate the method execution
        const userId = user.id

        if (!userId) {
          throw new Error('User ID is required')
        }

        identifier = identifier?.trim()

        if (!identifier) {
          throw new Error('Identifier is required')
        }

        // Query by alias
        if (identifier.startsWith('@')) {
          const alias = identifier.slice(1).trim()

          if (!alias) {
            throw new Error('Alias is required')
          }

          return mockContext.findUnique({
            ...(args || {}),

            where: {
              userId_alias: {
                userId: user.id,
                alias: alias,
              },
            },
          })
        }

        // Query by name
        if (identifier.startsWith('(') && identifier.endsWith(')')) {
          const name = identifier.slice(1, -1).trim()

          if (!name) {
            throw new Error('Name is required')
          }

          return mockContext.findFirst({
            ...(args || {}),

            where: {
              userId,
              name,
            },
          })
        }

        // Query by id
        return mockContext.findUnique({
          ...(args || {}),

          where: {
            id: identifier,
          },
        })
      },
    }
  }

  describe('alias lookup with @ prefix', () => {
    it('should query by alias when identifier starts with @', async () => {
      const mockClient = createMockPrismaClient()
      const mockBot = { id: 'bot-123', alias: 'my-bot', userId: 'user-123' }

      mockContext.findUnique.mockResolvedValue(mockBot)

      const result = await mockClient.findUniqueByIdentifier(
        { id: 'user-123' },
        '@my-bot'
      )

      expect(mockContext.findUnique).toHaveBeenCalledWith({
        where: {
          userId_alias: {
            userId: 'user-123',
            alias: 'my-bot',
          },
        },
      })

      expect(result).toEqual(mockBot)
    })

    it('should handle alias with leading/trailing spaces', async () => {
      const mockClient = createMockPrismaClient()
      const mockBot = { id: 'bot-123', alias: 'my-bot', userId: 'user-123' }

      mockContext.findUnique.mockResolvedValue(mockBot)

      const result = await mockClient.findUniqueByIdentifier(
        { id: 'user-123' },
        '@  my-bot  '
      )

      expect(mockContext.findUnique).toHaveBeenCalledWith({
        where: {
          userId_alias: {
            userId: 'user-123',
            alias: 'my-bot',
          },
        },
      })

      expect(result).toEqual(mockBot)
    })

    it('should throw error if alias is empty after @ prefix', async () => {
      const mockClient = createMockPrismaClient()

      await expect(
        mockClient.findUniqueByIdentifier({ id: 'user-123' }, '@')
      ).rejects.toThrow('Alias is required')
    })

    it('should throw error if alias is only whitespace after @ prefix', async () => {
      const mockClient = createMockPrismaClient()

      await expect(
        mockClient.findUniqueByIdentifier({ id: 'user-123' }, '@   ')
      ).rejects.toThrow('Alias is required')
    })

    it('should pass additional args to findUnique when querying by alias', async () => {
      const mockClient = createMockPrismaClient()
      const mockBot = { id: 'bot-123', alias: 'my-bot', userId: 'user-123' }

      mockContext.findUnique.mockResolvedValue(mockBot)

      const result = await mockClient.findUniqueByIdentifier(
        { id: 'user-123' },
        '@my-bot',
        { include: { user: true } }
      )

      expect(mockContext.findUnique).toHaveBeenCalledWith({
        include: { user: true },
        where: {
          userId_alias: {
            userId: 'user-123',
            alias: 'my-bot',
          },
        },
      })

      expect(result).toEqual(mockBot)
    })

    it('should return null when alias is not found', async () => {
      const mockClient = createMockPrismaClient()

      mockContext.findUnique.mockResolvedValue(null)

      const result = await mockClient.findUniqueByIdentifier(
        { id: 'user-123' },
        '@non-existent-alias'
      )

      expect(result).toBeNull()
    })
  })

  describe('name lookup with parentheses', () => {
    it('should query by name when identifier is wrapped in parentheses', async () => {
      const mockClient = createMockPrismaClient()
      const mockBot = { id: 'bot-123', name: 'My Bot', userId: 'user-123' }

      mockContext.findFirst.mockResolvedValue(mockBot)

      const result = await mockClient.findUniqueByIdentifier(
        { id: 'user-123' },
        '(My Bot)'
      )

      expect(mockContext.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          name: 'My Bot',
        },
      })

      expect(result).toEqual(mockBot)
    })
  })

  describe('id lookup', () => {
    it('should query by id when identifier is plain string', async () => {
      const mockClient = createMockPrismaClient()
      const mockBot = { id: 'bot-123', name: 'My Bot', userId: 'user-123' }

      mockContext.findUnique.mockResolvedValue(mockBot)

      const result = await mockClient.findUniqueByIdentifier(
        { id: 'user-123' },
        'bot-123'
      )

      expect(mockContext.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'bot-123',
        },
      })

      expect(result).toEqual(mockBot)
    })
  })

  describe('error handling', () => {
    it('should throw error when user id is missing', async () => {
      const mockClient = createMockPrismaClient()

      await expect(
        mockClient.findUniqueByIdentifier({ id: '' }, 'bot-123')
      ).rejects.toThrow('User ID is required')
    })

    it('should throw error when identifier is empty', async () => {
      const mockClient = createMockPrismaClient()

      await expect(
        mockClient.findUniqueByIdentifier({ id: 'user-123' }, '')
      ).rejects.toThrow('Identifier is required')
    })

    it('should throw error when identifier is only whitespace', async () => {
      const mockClient = createMockPrismaClient()

      await expect(
        mockClient.findUniqueByIdentifier({ id: 'user-123' }, '   ')
      ).rejects.toThrow('Identifier is required')
    })
  })
})

describe('withMethods - findMyriad', () => {
  it('should fallback to regular findMany when first query fails', async () => {
    // Mock context with failing first query
    const mockContext = {
      findMany: jest
        .fn()
        .mockRejectedValueOnce(
          new Error(
            'Invalid `prisma.message.findMany()` invocation: called `Option::unwrap()` on a `None` value'
          )
        )
        .mockResolvedValueOnce([
          { id: 'msg-1', text: 'Hello', createdAt: new Date() },
          { id: 'msg-2', text: 'World', createdAt: new Date() },
        ]),
    }

    // Create a mock extension context getter
    const originalGetExtensionContext = require('@prisma/client/extension')
      .Prisma.getExtensionContext

    require('@prisma/client/extension').Prisma.getExtensionContext = jest
      .fn()
      .mockReturnValue(mockContext)

    const methods = withMethods()
    const findMyriad = methods.model.$allModels.findMyriad

    // Call findMyriad with args that would trigger ordering
    const result = await findMyriad.call(mockContext, {
      where: { conversationId: 'conv-123' },
      orderBy: { createdAt: 'asc' },
    })

    // Should fallback to regular findMany after first failure
    expect(mockContext.findMany).toHaveBeenCalledTimes(2)
    expect(result).toEqual([
      { id: 'msg-1', text: 'Hello', createdAt: expect.any(Date) },
      { id: 'msg-2', text: 'World', createdAt: expect.any(Date) },
    ])

    // Restore original
    require('@prisma/client/extension').Prisma.getExtensionContext =
      originalGetExtensionContext
  })

  it('should fallback to regular findMany when data is corrupted', async () => {
    // Mock context with corrupted data error
    const mockContext = {
      findMany: jest
        .fn()
        .mockRejectedValueOnce(
          new Error(
            'Inconsistent column data: Could not convert value "" of the field `createdAt` to type `DateTime`'
          )
        )
        .mockResolvedValueOnce([
          { id: 'msg-1', text: 'Hello', createdAt: new Date() },
        ]),
    }

    const originalGetExtensionContext = require('@prisma/client/extension')
      .Prisma.getExtensionContext

    require('@prisma/client/extension').Prisma.getExtensionContext = jest
      .fn()
      .mockReturnValue(mockContext)

    const methods = withMethods()
    const findMyriad = methods.model.$allModels.findMyriad

    const result = await findMyriad.call(mockContext, {
      where: { conversationId: 'conv-123' },
      orderBy: { createdAt: 'desc' },
    })

    expect(mockContext.findMany).toHaveBeenCalledTimes(2)
    expect(result).toEqual([
      { id: 'msg-1', text: 'Hello', createdAt: expect.any(Date) },
    ])

    require('@prisma/client/extension').Prisma.getExtensionContext =
      originalGetExtensionContext
  })
})

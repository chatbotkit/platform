/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      memory: {
        findUniqueByIdentifier: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

const prisma = require('@/prisma/client').default

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((value) => value),
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('GET /api/v1/memory/[memoryId]/fetch', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { memoryId: 'memory_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when memory is not found', async () => {
    prisma.memory.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
  })

  it('returns 401 when memory belongs to another user', async () => {
    prisma.memory.findUniqueByIdentifier.mockResolvedValue({
      id: 'memory_1',
      userId: 'user_2',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
  })

  it('returns memory payload for owner without userId', async () => {
    prisma.memory.findUniqueByIdentifier.mockResolvedValue({
      id: 'memory_1',
      userId: 'user_1',
      name: 'Important Memory',
      description: 'desc',
      contactId: 'contact_1',
      botId: 'bot_1',
      text: 'remember this',
      meta: { source: 'unit-test' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    })

    const result = await handler(req, session)

    expect(prisma.memory.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'memory_1',
      {
        select: expect.objectContaining({
          id: true,
          userId: true,
          name: true,
          description: true,
          contactId: true,
          botId: true,
          text: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        }),
      }
    )
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      id: 'memory_1',
      name: 'Important Memory',
      contactId: 'contact_1',
      botId: 'bot_1',
      text: 'remember this',
    })
    expect(result.body.userId).toBeUndefined()
  })
})

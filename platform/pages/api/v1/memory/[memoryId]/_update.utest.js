/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import handler, { bodySchema } from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      memory: {
        findUniqueByIdentifier: jest.fn(),
        update: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((meta, previous) => ({
    ...(previous || {}),
    ...(meta || {}),
  })),
}))

jest.mock('@/schemas/contactId', () => ({
  __esModule: true,
  default: () =>
    jest.requireActual('@/lib/joi.schema').default.any().optional(),
}))

jest.mock('@/schemas/botId', () => ({
  __esModule: true,
  default: () =>
    jest.requireActual('@/lib/joi.schema').default.any().optional(),
}))

jest.mock('@/schemas/dbText', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default.string().required(),
}))

jest.mock('@/schemas/description', () => ({
  __esModule: true,
  default: jest
    .requireActual('@/lib/joi.schema')
    .default.string()
    .allow('')
    .optional(),
}))

jest.mock('@/schemas/meta', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default.object().optional(),
}))

jest.mock('@/schemas/name', () => ({
  __esModule: true,
  default: jest
    .requireActual('@/lib/joi.schema')
    .default.string()
    .allow('')
    .optional(),
}))

const prisma = require('@/prisma/client').default

describe('/api/v1/memory/[memoryId]/update', () => {
  const req = { query: { memoryId: 'mem_1' } }
  const session = { user: { id: 'user_1' } }
  const body = {
    name: 'Updated Name',
    description: 'Updated description',
    contactId: { id: 'contact_1' },
    botId: { id: 'bot_1' },
    text: 'Updated text',
    meta: { source: 'test' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('updates memory when owner and returns id', async () => {
    prisma.memory.findUniqueByIdentifier.mockResolvedValue({
      id: 'mem_1',
      userId: 'user_1',
      meta: { previous: true },
    })
    prisma.memory.update.mockResolvedValue({ id: 'mem_1' })

    const result = await handler(req, session, body)

    expect(prisma.memory.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'mem_1'
    )
    expect(prisma.memory.update).toHaveBeenCalledWith({
      where: { id: 'mem_1' },
      data: {
        name: 'Updated Name',
        description: 'Updated description',
        contactId: 'contact_1',
        botId: 'bot_1',
        text: 'Updated text',
        meta: { previous: true, source: 'test' },
      },
    })
    expect(result).toEqual({ status: 200, body: { id: 'mem_1' } })
  })

  it('returns 404 when memory is missing', async () => {
    prisma.memory.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, body)

    expect(result).toEqual({ status: 404 })
    expect(prisma.memory.update).not.toHaveBeenCalled()
  })

  it('returns 401 when memory belongs to another user', async () => {
    prisma.memory.findUniqueByIdentifier.mockResolvedValue({
      id: 'mem_1',
      userId: 'user_2',
      meta: {},
    })

    const result = await handler(req, session, body)

    expect(result).toEqual({ status: 401 })
    expect(prisma.memory.update).not.toHaveBeenCalled()
  })

  it('validates request body schema', () => {
    expect(bodySchema.validate({ text: 'x' }).error).toBeUndefined()
  })
})

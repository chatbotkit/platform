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
      file: {
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

describe('GET /api/v1/file/[fileId]/fetch', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { fileId: 'file_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when file is not found', async () => {
    prisma.file.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
  })

  it('returns 401 when file belongs to another user', async () => {
    prisma.file.findUniqueByIdentifier.mockResolvedValue({
      id: 'file_1',
      userId: 'user_2',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
  })

  it('returns file payload for owner without userId', async () => {
    prisma.file.findUniqueByIdentifier.mockResolvedValue({
      id: 'file_1',
      alias: 'my-file',
      userId: 'user_1',
      name: 'my file',
      description: 'desc',
      blueprintId: 'blueprint_1',
      visibility: 'private',
      meta: { mime: 'text/plain' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    })

    const result = await handler(req, session)

    expect(prisma.file.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'file_1',
      {
        select: expect.objectContaining({
          id: true,
          alias: true,
          userId: true,
          name: true,
          description: true,
          blueprintId: true,
          visibility: true,
          meta: true,
          createdAt: true,
          updatedAt: true,
        }),
      }
    )
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      id: 'file_1',
      alias: 'my-file',
      name: 'my file',
      blueprintId: 'blueprint_1',
      visibility: 'private',
    })
    expect(result.body.userId).toBeUndefined()
  })
})

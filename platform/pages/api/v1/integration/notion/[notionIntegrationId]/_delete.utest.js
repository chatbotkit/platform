/**
 * @jest-environment node
 */
import handler from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      notionIntegration: {
        findUniqueByIdentifier: jest.fn(),
        delete: jest.fn(),
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

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

const prisma = jest.requireMock('@/prisma/client').default

describe('POST /api/v1/integration/notion/[notionIntegrationId]/delete', () => {
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when integration does not exist', async () => {
    prisma.notionIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const response = await handler(
      { query: { notionIntegrationId: 'n-1' } },
      session
    )

    expect(response.status).toBe(404)
    expect(prisma.notionIntegration.delete).not.toHaveBeenCalled()
  })

  it('returns 403 when integration belongs to another user', async () => {
    prisma.notionIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'n-1',
      userId: 'other-user',
    })

    const response = await handler(
      { query: { notionIntegrationId: 'n-1' } },
      session
    )

    expect(response.status).toBe(403)
    expect(prisma.notionIntegration.delete).not.toHaveBeenCalled()
  })

  it('deletes integration and returns id for owner', async () => {
    prisma.notionIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'n-1',
      userId: 'user-1',
    })
    prisma.notionIntegration.delete.mockResolvedValue({ id: 'n-1' })

    const response = await handler(
      { query: { notionIntegrationId: 'n-1' } },
      session
    )

    expect(
      prisma.notionIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(session.user, 'n-1', {
      select: { id: true, userId: true },
    })
    expect(prisma.notionIntegration.delete).toHaveBeenCalledWith({
      where: { id: 'n-1' },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 'n-1' })
  })
})

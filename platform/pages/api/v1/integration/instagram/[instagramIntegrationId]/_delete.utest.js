/**
 * @jest-environment node
 */
import handler from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      instagramIntegration: {
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
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

const prisma = jest.requireMock('@/prisma/client').default

describe('POST /api/v1/integration/instagram/[instagramIntegrationId]/delete', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { instagramIntegrationId: 'ig-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when integration does not exist', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const response = await handler(req, session)

    expect(response.status).toBe(404)
    expect(prisma.instagramIntegration.delete).not.toHaveBeenCalled()
  })

  it('returns 403 when integration belongs to another user', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'ig-1',
      userId: 'other-user',
    })

    const response = await handler(req, session)

    expect(response.status).toBe(403)
    expect(prisma.instagramIntegration.delete).not.toHaveBeenCalled()
  })

  it('deletes integration and returns id for owner', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'ig-1',
      userId: 'user-1',
    })
    prisma.instagramIntegration.delete.mockResolvedValue({ id: 'ig-1' })

    const response = await handler(req, session)

    expect(
      prisma.instagramIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(session.user, 'ig-1', {
      select: { id: true, userId: true },
    })
    expect(prisma.instagramIntegration.delete).toHaveBeenCalledWith({
      where: { id: 'ig-1' },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 'ig-1' })
  })
})

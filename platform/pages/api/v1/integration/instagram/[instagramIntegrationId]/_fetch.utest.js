/**
 * @jest-environment node
 */
import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    instagramIntegration: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

const prisma = jest.requireMock('@/prisma/client').default

describe('GET /api/v1/integration/instagram/[instagramIntegrationId]/fetch', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { instagramIntegrationId: 'ig-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when integration is not found', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const response = await handler(req, session)

    expect(response.status).toBe(404)
  })

  it('returns 403 when integration belongs to another user', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'ig-1',
      userId: 'other-user',
    })

    const response = await handler(req, session)

    expect(response.status).toBe(403)
  })

  it('returns 200, removes userId, and masks accessToken', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'ig-1',
      name: 'Instagram',
      description: 'desc',
      userId: 'user-1',
      blueprintId: null,
      botId: 'bot-1',
      verifyToken: 'verify',
      accessToken: 'secret-token',
      contactCollection: true,
      sessionDuration: 123,
      attachments: true,
      meta: { a: 1 },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    })

    const response = await handler(req, session)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.userId).toBeUndefined()
    expect(data.accessToken).toBe('********')
    expect(data.id).toBe('ig-1')
  })

  it('selects appSecret so it can be reported as configured', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'ig-1',
      userId: 'user-1',
    })

    await handler(req, session)

    expect(
      prisma.instagramIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(
      session.user,
      'ig-1',
      expect.objectContaining({
        select: expect.objectContaining({
          accessToken: true,
          appSecret: true,
        }),
      })
    )
  })

  it('masks the Meta app secret', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'ig-1',
      userId: 'user-1',
      appSecret: 'meta-app-secret',
    })

    const response = await handler(req, session)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.appSecret).toBe('********')
  })

  it('keeps appSecret null when not configured', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'ig-1',
      userId: 'user-1',
      appSecret: null,
    })

    const response = await handler(req, session)
    const data = await response.json()

    expect(data.appSecret).toBeNull()
  })

  it('keeps accessToken null when not configured', async () => {
    prisma.instagramIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'ig-1',
      userId: 'user-1',
      accessToken: null,
    })

    const response = await handler(req, session)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.accessToken).toBeNull()
  })
})

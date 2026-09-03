/**
 * @jest-environment node
 */
import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      whatsappIntegration: {
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
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((data) => data),
}))

const prisma = jest.requireMock('@/prisma/client').default

describe('GET /api/v1/integration/whatsapp/[whatsappIntegrationId]/fetch', () => {
  const req = { query: { whatsappIntegrationId: 'whatsapp_123' } }
  const session = { user: { id: 'user_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when integration does not exist', async () => {
    prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const res = await handler(req, session)

    expect(res.status).toBe(404)
  })

  it('returns 403 when integration belongs to another user', async () => {
    prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'whatsapp_123',
      userId: 'other_user',
    })

    const res = await handler(req, session)

    expect(res.status).toBe(403)
  })

  it('masks accessToken and strips userId for owner', async () => {
    prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'whatsapp_123',
      userId: 'user_1',
      verifyToken: 'verify-token',
      phoneNumberId: '12345',
      accessToken: 'secret-token',
      contactCollection: true,
      attachments: false,
      allowFrom: '*',
    })

    const res = await handler(req, session)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.id).toBe('whatsapp_123')
    expect(data.userId).toBeUndefined()
    expect(data.accessToken).toBe('********')
    expect(
      prisma.whatsappIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(
      session.user,
      'whatsapp_123',
      expect.objectContaining({
        select: expect.objectContaining({
          userId: true,
          accessToken: true,
        }),
      })
    )
  })

  it('returns null accessToken when token is not configured', async () => {
    prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'whatsapp_123',
      userId: 'user_1',
      accessToken: null,
    })

    const res = await handler(req, session)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.accessToken).toBeNull()
  })

  it('masks the Meta app secret', async () => {
    prisma.whatsappIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'whatsapp_123',
      userId: 'user_1',
      appSecret: 'meta-app-secret',
    })

    const res = await handler(req, session)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.appSecret).toBe('********')
  })

  it('propagates database errors', async () => {
    prisma.whatsappIntegration.findUniqueByIdentifier.mockRejectedValue(
      new Error('db failed')
    )

    await expect(handler(req, session)).rejects.toThrow('db failed')
  })
})

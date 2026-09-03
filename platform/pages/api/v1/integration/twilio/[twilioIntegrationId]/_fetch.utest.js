/**
 * @jest-environment node
 */
import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      twilioIntegration: {
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

describe('GET /api/v1/integration/twilio/[twilioIntegrationId]/fetch', () => {
  const req = { query: { twilioIntegrationId: 'twilio_123' } }
  const session = { user: { id: 'user_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when integration does not exist', async () => {
    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const res = await handler(req, session)

    expect(res.status).toBe(404)
  })

  it('returns 403 when integration belongs to another user', async () => {
    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'twilio_123',
      userId: 'other_user',
    })

    const res = await handler(req, session)

    expect(res.status).toBe(403)
  })

  it('returns 200 for owner and strips userId', async () => {
    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'twilio_123',
      name: 'Twilio',
      userId: 'user_1',
      accountSid: 'AC123',
      allowFrom: '*',
      meta: { source: 'test' },
    })

    const res = await handler(req, session)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.id).toBe('twilio_123')
    expect(data.accountSid).toBe('AC123')
    expect(data.userId).toBeUndefined()
    expect(
      prisma.twilioIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(
      session.user,
      'twilio_123',
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          userId: true,
          accountSid: true,
        }),
      })
    )
  })

  it('propagates database errors', async () => {
    prisma.twilioIntegration.findUniqueByIdentifier.mockRejectedValue(
      new Error('db failed')
    )

    await expect(handler(req, session)).rejects.toThrow('db failed')
  })
})

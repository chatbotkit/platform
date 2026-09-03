/**
 * @jest-environment node
 */
import handler from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      twilioIntegration: {
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

describe('POST /api/v1/integration/twilio/[twilioIntegrationId]/delete', () => {
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when integration does not exist', async () => {
    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const response = await handler(
      { query: { twilioIntegrationId: 't-1' } },
      session
    )

    expect(response.status).toBe(404)
    expect(prisma.twilioIntegration.delete).not.toHaveBeenCalled()
  })

  it('returns 403 when integration belongs to another user', async () => {
    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 't-1',
      userId: 'other-user',
    })

    const response = await handler(
      { query: { twilioIntegrationId: 't-1' } },
      session
    )

    expect(response.status).toBe(403)
    expect(prisma.twilioIntegration.delete).not.toHaveBeenCalled()
  })

  it('deletes integration and returns id for owner', async () => {
    prisma.twilioIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 't-1',
      userId: 'user-1',
    })
    prisma.twilioIntegration.delete.mockResolvedValue({ id: 't-1' })

    const response = await handler(
      { query: { twilioIntegrationId: 't-1' } },
      session
    )

    expect(
      prisma.twilioIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(session.user, 't-1', {
      select: { id: true, userId: true },
    })
    expect(prisma.twilioIntegration.delete).toHaveBeenCalledWith({
      where: { id: 't-1' },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 't-1' })
  })
})

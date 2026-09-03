/**
 * @jest-environment node
 */
import handler from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      widgetIntegration: {
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

describe('POST /api/v1/integration/widget/[widgetIntegrationId]/delete', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { widgetIntegrationId: 'widget-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when integration does not exist', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const response = await handler(req, session)

    expect(response.status).toBe(404)
    expect(prisma.widgetIntegration.delete).not.toHaveBeenCalled()
  })

  it('returns 403 when integration belongs to another user', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'widget-1',
      userId: 'other-user',
    })

    const response = await handler(req, session)

    expect(response.status).toBe(403)
    expect(prisma.widgetIntegration.delete).not.toHaveBeenCalled()
  })

  it('deletes integration and returns id for owner', async () => {
    prisma.widgetIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'widget-1',
      userId: 'user-1',
    })
    prisma.widgetIntegration.delete.mockResolvedValue({ id: 'widget-1' })

    const response = await handler(req, session)

    expect(
      prisma.widgetIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(session.user, 'widget-1', {
      select: { id: true, userId: true },
    })
    expect(prisma.widgetIntegration.delete).toHaveBeenCalledWith({
      where: { id: 'widget-1' },
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ id: 'widget-1' })
  })
})

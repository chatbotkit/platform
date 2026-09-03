/**
 * @jest-environment node
 */
import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      notionIntegration: {
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

const prisma = jest.requireMock('@/prisma/client').default

describe('GET /api/v1/integration/notion/[notionIntegrationId]/fetch', () => {
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
  })

  it('returns masked token and strips userId for owner', async () => {
    prisma.notionIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'n-1',
      userId: 'user-1',
      name: 'Notion Sync',
      description: '',
      blueprintId: null,
      datasetId: 'd-1',
      token: 'super-secret',
      syncStatus: 'ready',
      syncSchedule: '@daily',
      lastSyncedAt: new Date('2026-01-01T00:00:00Z'),
      expiresIn: 1000,
      meta: { source: 'test' },
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    })

    const response = await handler(
      { query: { notionIntegrationId: 'n-1' } },
      session
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.id).toBe('n-1')
    expect(body.userId).toBeUndefined()
    expect(body.token).toBe('********')
    expect(body.datasetId).toBe('d-1')
  })

  it('keeps token null when no token is configured', async () => {
    prisma.notionIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'n-1',
      userId: 'user-1',
      name: 'Notion Sync',
      description: '',
      blueprintId: null,
      datasetId: 'd-1',
      token: null,
      syncStatus: null,
      syncSchedule: null,
      lastSyncedAt: null,
      expiresIn: null,
      meta: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    })

    const response = await handler(
      { query: { notionIntegrationId: 'n-1' } },
      session
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.token).toBeNull()
  })
})

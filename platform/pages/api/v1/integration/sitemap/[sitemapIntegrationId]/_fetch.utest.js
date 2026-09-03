/**
 * @jest-environment node
 */
import handler from './fetch'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      sitemapIntegration: {
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

describe('GET /api/v1/integration/sitemap/[sitemapIntegrationId]/fetch', () => {
  const req = { query: { sitemapIntegrationId: 'sitemap_123' } }
  const session = { user: { id: 'user_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when integration does not exist', async () => {
    prisma.sitemapIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const res = await handler(req, session)

    expect(res.status).toBe(404)
  })

  it('returns 403 when integration belongs to another user', async () => {
    prisma.sitemapIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'sitemap_123',
      userId: 'other_user',
    })

    const res = await handler(req, session)

    expect(res.status).toBe(403)
  })

  it('returns 200 for owner and strips userId', async () => {
    prisma.sitemapIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'sitemap_123',
      userId: 'user_1',
      url: 'https://example.com/sitemap.xml',
      datasetId: 'dataset_1',
      javascript: true,
      syncSchedule: 'daily',
      meta: { source: 'test' },
    })

    const res = await handler(req, session)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.id).toBe('sitemap_123')
    expect(data.datasetId).toBe('dataset_1')
    expect(data.userId).toBeUndefined()
    expect(
      prisma.sitemapIntegration.findUniqueByIdentifier
    ).toHaveBeenCalledWith(
      session.user,
      'sitemap_123',
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          userId: true,
          datasetId: true,
          syncSchedule: true,
        }),
      })
    )
  })

  it('propagates database errors', async () => {
    prisma.sitemapIntegration.findUniqueByIdentifier.mockRejectedValue(
      new Error('db failed')
    )

    await expect(handler(req, session)).rejects.toThrow('db failed')
  })
})

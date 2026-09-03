/**
 * @jest-environment node
 */
import handler from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      sitemapIntegration: {
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

describe('POST /api/v1/integration/sitemap/[sitemapIntegrationId]/delete', () => {
  const session = { user: { id: 'user-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when integration does not exist', async () => {
    prisma.sitemapIntegration.findUniqueByIdentifier.mockResolvedValue(null)

    const response = await handler(
      { query: { sitemapIntegrationId: 'sitemap-1' } },
      session
    )

    expect(response.status).toBe(404)
    expect(prisma.sitemapIntegration.delete).not.toHaveBeenCalled()
  })

  it('returns 403 when integration belongs to another user', async () => {
    prisma.sitemapIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'sitemap-1',
      userId: 'other-user',
    })

    const response = await handler(
      { query: { sitemapIntegrationId: 'sitemap-1' } },
      session
    )

    expect(response.status).toBe(403)
    expect(prisma.sitemapIntegration.delete).not.toHaveBeenCalled()
  })

  it('deletes integration and returns id for owner', async () => {
    prisma.sitemapIntegration.findUniqueByIdentifier.mockResolvedValue({
      id: 'sitemap-1',
      userId: 'user-1',
    })
    prisma.sitemapIntegration.delete.mockResolvedValue({ id: 'sitemap-1' })

    const response = await handler(
      { query: { sitemapIntegrationId: 'sitemap-1' } },
      session
    )

    expect(prisma.sitemapIntegration.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'sitemap-1',
      {
        select: { id: true, userId: true },
      }
    )
    expect(prisma.sitemapIntegration.delete).toHaveBeenCalledWith({
      where: { id: 'sitemap-1' },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 'sitemap-1' })
  })
})

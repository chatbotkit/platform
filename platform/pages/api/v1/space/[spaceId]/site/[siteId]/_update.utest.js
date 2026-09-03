/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      space: {
        findUniqueByIdentifier: jest.fn(),
      },
      spaceSite: {
        findUniqueByIdentifier: jest.fn(),
        update: jest.fn(),
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

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((meta, prev) => ({ ...prev, ...meta })),
}))

jest.mock('@/lib/space.site', () => ({
  assertSpaceSiteSlug: jest.fn(),
  normalizeSpaceSiteSlug: jest.fn((slug) => slug),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

const { assertSpaceSiteSlug } = require('@/lib/space.site')

describe('POST /api/v1/space/[spaceId]/site/[siteId]/update', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { spaceId: 'space_1', siteId: 'site_1' } }

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.space.findUniqueByIdentifier.mockResolvedValue({
      id: 'space_1',
      userId: 'user_1',
    })

    prisma.spaceSite.findUniqueByIdentifier.mockResolvedValue({
      id: 'site_1',
      userId: 'user_1',
      spaceId: 'space_1',
      meta: { keep: true },
    })
  })

  it('returns 404 when the site belongs to another space', async () => {
    prisma.spaceSite.findUniqueByIdentifier.mockResolvedValue({
      id: 'site_1',
      userId: 'user_1',
      spaceId: 'space_other',
    })

    const result = await handler(req, session, { name: 'x' })

    expect(result).toEqual({ status: 404 })
    expect(prisma.spaceSite.update).not.toHaveBeenCalled()
  })

  it('does not validate the slug when it is not provided', async () => {
    prisma.spaceSite.update.mockResolvedValue({ id: 'site_1' })

    await handler(req, session, { name: 'Renamed' })

    expect(assertSpaceSiteSlug).not.toHaveBeenCalled()
    expect(prisma.spaceSite.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'site_1' },
        data: expect.objectContaining({ name: 'Renamed', slug: undefined }),
      })
    )
  })

  it('validates the slug when provided and updates', async () => {
    prisma.spaceSite.update.mockResolvedValue({ id: 'site_1' })

    const result = await handler(req, session, {
      slug: 'new-site',
    })

    expect(assertSpaceSiteSlug).toHaveBeenCalledWith('new-site')
    expect(result).toEqual({ status: 200, body: { id: 'site_1' } })
  })

  it('exposes a body schema with an optional slug', () => {
    const described = bodySchema.describe()

    expect(described.keys.slug).toBeDefined()
    expect(described.keys.slug.flags?.presence).not.toBe('required')
  })
})

/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './create'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      space: {
        findUniqueByIdentifier: jest.fn(),
      },
      spaceSite: {
        create: jest.fn(),
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

jest.mock('@/lib/space.site', () => ({
  assertSpaceSiteSlug: jest.fn(),
  normalizeSpaceSiteSlug: jest.fn((slug) => slug),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

const {
  assertSpaceSiteSlug,
  normalizeSpaceSiteSlug,
} = require('@/lib/space.site')

describe('POST /api/v1/space/[spaceId]/site/create', () => {
  const session = { user: { id: 'user_1' } }
  const req = { query: { spaceId: 'space_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when the space does not exist', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, {
      slug: 'acme',
    })

    expect(result).toEqual({ status: 404 })
    expect(prisma.spaceSite.create).not.toHaveBeenCalled()
  })

  it('returns 401 when the space owner differs', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue({
      id: 'space_1',
      userId: 'user_2',
    })

    const result = await handler(req, session, {
      slug: 'acme',
    })

    expect(result).toEqual({ status: 401 })
    expect(prisma.spaceSite.create).not.toHaveBeenCalled()
  })

  it('creates a site and returns its id', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue({
      id: 'space_1',
      userId: 'user_1',
    })

    prisma.spaceSite.create.mockResolvedValue({ id: 'site_1' })

    const result = await handler(req, session, {
      name: 'Marketing',
      description: 'Marketing site',
      slug: 'acme',
      prefix: 'marketing',
      index: 'home.html',
      notFound: 'missing.html',
      meta: { env: 'prod' },
    })

    expect(result).toEqual({ status: 200, body: { id: 'site_1' } })

    expect(normalizeSpaceSiteSlug).toHaveBeenCalledWith('acme')
    expect(assertSpaceSiteSlug).toHaveBeenCalledWith('acme')

    expect(prisma.spaceSite.create).toHaveBeenCalledWith({
      data: {
        userId: 'user_1',
        spaceId: 'space_1',
        alias: undefined,
        name: 'Marketing',
        description: 'Marketing site',
        slug: 'acme',
        prefix: 'marketing',
        index: 'home.html',
        notFound: 'missing.html',
        meta: { env: 'prod' },
      },
      select: { id: true },
    })
  })

  it('leaves serving defaults to the database when omitted', async () => {
    prisma.space.findUniqueByIdentifier.mockResolvedValue({
      id: 'space_1',
      userId: 'user_1',
    })

    prisma.spaceSite.create.mockResolvedValue({ id: 'site_2' })

    await handler(req, session, { slug: 'docs-site' })

    expect(prisma.spaceSite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'docs-site',
          index: undefined,
          notFound: undefined,
        }),
      })
    )
  })

  it('exposes a body schema requiring a slug', () => {
    expect(bodySchema).toBeDefined()

    const described = bodySchema.describe()

    expect(described.keys.slug).toBeDefined()
    expect(described.keys.slug.flags?.presence).toBe('required')
  })
})

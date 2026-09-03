/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import { MAX_DB_STRING_BYTES_LENGTH } from '@/prisma/constraints'

import handler, { bodySchema } from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      sitemapIntegration: {
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

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((meta, previous) => ({
    ...(previous || {}),
    ...(meta || {}),
  })),
}))

// `blueprintId`/`datasetId` schemas reach into prisma via an `external` rule, so
// stub them out - they are not relevant to the column-length validation.

jest.mock('@/schemas/blueprintId', () => ({
  __esModule: true,
  default: () =>
    jest.requireActual('@/lib/joi.schema').default.any().optional(),
}))

jest.mock('@/schemas/datasetId', () => ({
  __esModule: true,
  default: () =>
    jest.requireActual('@/lib/joi.schema').default.any().optional(),
}))

const prisma = require('@/prisma/client').default

// a valid CSS selector list that comfortably exceeds the VARCHAR(191) column

const longSelectors = Array(60).fill('div').join(', ')

const itIfStringLengthIsConstrained =
  MAX_DB_STRING_BYTES_LENGTH <= 1000000 ? it : it.skip

describe('/api/v1/integration/sitemap/[sitemapIntegrationId]/update', () => {
  const req = { query: { sitemapIntegrationId: 'sitemap_1' } }
  const session = { user: { id: 'user_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('bodySchema', () => {
    it('accepts a glob within the column length limit', () => {
      const { error } = bodySchema.validate({ glob: '**/docs/**' })

      expect(error).toBeUndefined()
    })

    it('accepts selectors within the column length limit', () => {
      const { error } = bodySchema.validate({
        selectors: 'article.content, div.documentation',
      })

      expect(error).toBeUndefined()
    })

    // regression: an over-long `glob` reached the
    // VARCHAR(191) column and produced a Prisma P2000 instead of a 400.
    itIfStringLengthIsConstrained(
      'rejects a glob longer than the column length limit',
      () => {
        const { error } = bodySchema.validate({
          glob: 'a'.repeat(MAX_DB_STRING_BYTES_LENGTH + 1),
        })

        expect(error).toBeDefined()
        expect(error.message).toMatch(/glob/)
        expect(error.message).toMatch(/bytes/)
      }
    )

    // regression: an over-long `selectors` value reached the
    // VARCHAR(191) column and produced a Prisma P2000 instead of a 400.
    itIfStringLengthIsConstrained(
      'rejects selectors longer than the column length limit',
      () => {
        expect(longSelectors.length).toBeGreaterThan(MAX_DB_STRING_BYTES_LENGTH)

        const { error } = bodySchema.validate({ selectors: longSelectors })

        expect(error).toBeDefined()
        expect(error.message).toMatch(/selectors/)
        expect(error.message).toMatch(/bytes/)
      }
    )

    it('still rejects invalid selectors regardless of length', () => {
      const { error } = bodySchema.validate({ selectors: 'div >' })

      expect(error).toBeDefined()
    })
  })

  describe('handler', () => {
    it('updates the integration for the owner and returns its id', async () => {
      prisma.sitemapIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: 'sitemap_1',
        userId: 'user_1',
        meta: { previous: true },
      })
      prisma.sitemapIntegration.update.mockResolvedValue({ id: 'sitemap_1' })

      const result = await handler(req, session, {
        glob: '**/docs/**',
        selectors: 'article.content',
      })

      expect(prisma.sitemapIntegration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sitemap_1' },
          data: expect.objectContaining({
            glob: '**/docs/**',
            selectors: 'article.content',
          }),
        })
      )
      expect(result).toEqual({ status: 200, body: { id: 'sitemap_1' } })
    })

    it('returns 404 when the integration is missing', async () => {
      prisma.sitemapIntegration.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(req, session, {})

      expect(result).toEqual({ status: 404 })
      expect(prisma.sitemapIntegration.update).not.toHaveBeenCalled()
    })

    it('returns 401 when the integration belongs to another user', async () => {
      prisma.sitemapIntegration.findUniqueByIdentifier.mockResolvedValue({
        id: 'sitemap_1',
        userId: 'user_2',
        meta: {},
      })

      const result = await handler(req, session, {})

      expect(result).toEqual({ status: 401 })
      expect(prisma.sitemapIntegration.update).not.toHaveBeenCalled()
    })
  })
})

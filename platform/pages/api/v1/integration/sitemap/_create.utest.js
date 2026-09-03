/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import { MAX_DB_STRING_BYTES_LENGTH } from '@/prisma/constraints'

import handler, { bodySchema } from './create'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      sitemapIntegration: {
        create: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: jest.requireActual('@/lib/joi.schema').default,
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
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

describe('/api/v1/integration/sitemap/create', () => {
  const session = { user: { id: 'user_1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('bodySchema', () => {
    it('accepts a glob and selectors within the column length limit', () => {
      const { error } = bodySchema.validate({
        glob: '**/docs/**',
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
  })

  describe('handler', () => {
    it('creates the integration and returns its id', async () => {
      prisma.sitemapIntegration.create.mockResolvedValue({ id: 'sitemap_1' })

      const result = await handler({}, session, {
        glob: '**/docs/**',
        selectors: 'article.content',
      })

      expect(prisma.sitemapIntegration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user_1',
            glob: '**/docs/**',
            selectors: 'article.content',
          }),
        })
      )
      expect(result).toEqual({ status: 200, body: { id: 'sitemap_1' } })
    })
  })
})

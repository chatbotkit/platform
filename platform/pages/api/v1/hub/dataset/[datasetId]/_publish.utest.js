/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import { detectContentAbuse } from '@/lib/moderation'

import handler, { bodySchema } from './publish'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      dataset: {
        findUniqueByIdentifier: jest.fn(),
      },
      hubDatasetPage: {
        upsert: jest.fn(),
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
  badRequest: (message) => ({ status: 400, body: { message } }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

jest.mock('@/lib/moderation', () => ({
  detectContentAbuse: jest.fn(),
}))

jest.mock('@/lib/user.type', () => ({
  isVip: jest.fn(() => false),
}))

const prisma = require('@/prisma/client').default

describe('/api/v1/hub/dataset/[datasetId]/publish', () => {
  const req = { query: { datasetId: 'ds_1' } }
  const session = { user: { id: 'user_1' } }
  const body = {
    name: 'Dataset Name',
    description: 'Dataset description',
    icon: 'icon',
    meta: { source: 'test' },
    slug: 'dataset-name',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    detectContentAbuse.mockResolvedValue({ flagged: false, categories: [] })
  })

  it('publishes dataset for owner and returns hub page id', async () => {
    prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ds_1',
      userId: 'user_1',
      name: 'Fallback Name',
      description: 'Fallback description',
    })
    prisma.hubDatasetPage.upsert.mockResolvedValue({ id: 'hub_ds_1' })

    const result = await handler(req, session, body)

    expect(detectContentAbuse).toHaveBeenCalled()
    expect(prisma.hubDatasetPage.upsert).toHaveBeenCalled()
    expect(result).toEqual({
      status: 200,
      body: { id: 'hub_ds_1', datasetId: 'ds_1' },
    })
  })

  it('returns 404 when dataset is not found', async () => {
    prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session, body)

    expect(result).toEqual({ status: 404 })
    expect(prisma.hubDatasetPage.upsert).not.toHaveBeenCalled()
  })

  it('returns 401 when dataset belongs to different user', async () => {
    prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ds_1',
      userId: 'user_2',
      name: 'Dataset',
      description: 'desc',
    })

    const result = await handler(req, session, body)

    expect(result).toEqual({ status: 401 })
    expect(prisma.hubDatasetPage.upsert).not.toHaveBeenCalled()
  })

  it('returns 400 when moderation flags content', async () => {
    prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ds_1',
      userId: 'user_1',
      name: 'Dataset',
      description: 'desc',
    })
    detectContentAbuse.mockResolvedValue({
      flagged: true,
      categories: ['hate', 'violence'],
    })

    const result = await handler(req, session, body)

    expect(result.status).toBe(400)
    expect(result.body.message).toContain('hate, violence')
    expect(prisma.hubDatasetPage.upsert).not.toHaveBeenCalled()
  })

  it('validates body schema', async () => {
    await expect(bodySchema.validateAsync({})).resolves.toBeDefined()
  })
})

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { deleteDataset } from '@/lib/dataset.delete'

import handler from './delete'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      dataset: {
        findUniqueByIdentifier: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/dataset.delete', () => ({
  deleteDataset: jest.fn(),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('POST /api/v1/dataset/[datasetId]/delete', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { datasetId: 'ds-1' } }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 404 when dataset does not exist', async () => {
    prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)

    const result = await handler(req, session)

    expect(result).toEqual({ status: 404 })
    expect(deleteDataset).not.toHaveBeenCalled()
  })

  it('returns 401 when dataset is owned by another user', async () => {
    prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
      id: 'ds-1',
      userId: 'user-2',
    })

    const result = await handler(req, session)

    expect(result).toEqual({ status: 401 })
    expect(deleteDataset).not.toHaveBeenCalled()
  })

  it('deletes dataset and returns id for owner', async () => {
    const dataset = { id: 'ds-1', userId: 'user-1' }

    prisma.dataset.findUniqueByIdentifier.mockResolvedValue(dataset)

    const result = await handler(req, session)

    expect(prisma.dataset.findUniqueByIdentifier).toHaveBeenCalledWith(
      session.user,
      'ds-1',
      {
        select: {
          id: true,
          userId: true,
        },
      }
    )
    expect(deleteDataset).toHaveBeenCalledWith(dataset)
    expect(result).toEqual({ status: 200, body: { id: 'ds-1' } })
  })
})

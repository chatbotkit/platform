/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { getStore } from '@/lib/store.types'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    dataset: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
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

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((v) => v),
}))

jest.mock('@/lib/store.types', () => ({
  getStore: jest.fn(),
}))

describe('GET /api/v1/dataset/[datasetId]/record/[recordId]/fetch', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { datasetId: 'dataset-1', recordId: 'record-1' } }

  const mockDataset = {
    id: 'dataset-1',
    userId: 'user-1',
  }

  const mockRecord = {
    id: 'record-1',
    text: 'Record text content',
    source: 'docs/page.md',
    meta: { category: 'faq' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('authorization', () => {
    it('returns 404 when dataset does not exist', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(req, session)

      expect(result).toEqual({ status: 404 })
      expect(getStore).not.toHaveBeenCalled()
    })

    it('returns 401 when dataset belongs to another user', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...mockDataset,
        userId: 'user-2',
      })

      const result = await handler(req, session)

      expect(result).toEqual({ status: 401 })
      expect(getStore).not.toHaveBeenCalled()
    })
  })

  describe('record retrieval', () => {
    it('returns 404 when store throws for a missing record', async () => {
      const store = {
        accessRecord: jest
          .fn()
          .mockRejectedValue(new Error('record not found')),
      }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      getStore.mockResolvedValue(store)

      const result = await handler(req, session)

      expect(store.accessRecord).toHaveBeenCalledWith({
        datasetId: 'dataset-1',
        recordId: 'record-1',
      })
      expect(result).toEqual({ status: 404 })
    })

    it('returns the record payload on success', async () => {
      const store = {
        accessRecord: jest.fn().mockResolvedValue(mockRecord),
      }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      getStore.mockResolvedValue(store)

      const result = await handler(req, session)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({
        id: 'record-1',
        text: 'Record text content',
        source: 'docs/page.md',
        meta: { category: 'faq' },
      })
    })

    it('calls getStore with the dataset store configuration', async () => {
      const store = {
        accessRecord: jest.fn().mockResolvedValue(mockRecord),
      }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...mockDataset,
      })
      getStore.mockResolvedValue(store)

      await handler(req, session)

      expect(getStore).toHaveBeenCalledWith()
    })

    it('passes correct datasetId and recordId from request params to the store', async () => {
      const store = {
        accessRecord: jest.fn().mockResolvedValue(mockRecord),
      }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...mockDataset,
        id: 'resolved-dataset-id',
      })
      getStore.mockResolvedValue(store)

      const reqWithDifferentIds = {
        query: { datasetId: 'alias-or-id', recordId: 'rec-xyz' },
      }

      await handler(reqWithDifferentIds, session)

      // @note the resolved dataset.id is passed to the store, not the raw query param
      expect(store.accessRecord).toHaveBeenCalledWith({
        datasetId: 'resolved-dataset-id',
        recordId: 'rec-xyz',
      })
    })

    it('does not expose extra fields from the store record', async () => {
      const storeRecord = {
        id: 'record-1',
        text: 'Some text',
        source: 'src.txt',
        meta: {},
        internalField: 'should-not-be-exposed',
        embedding: [0.1, 0.2, 0.3],
      }

      const store = {
        accessRecord: jest.fn().mockResolvedValue(storeRecord),
      }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      getStore.mockResolvedValue(store)

      const result = await handler(req, session)

      expect(result.status).toBe(200)
      expect(result.body).not.toHaveProperty('internalField')
      expect(result.body).not.toHaveProperty('embedding')
    })
  })
})

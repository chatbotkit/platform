/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './search'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    dataset: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/dataset.access', () => ({
  canUseDataset: jest.fn(),
}))

jest.mock('@/lib/dataset.search', () => ({
  searchDataset: jest.fn(),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((v) => v),
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: {
    object: jest.fn().mockReturnThis(),
    string: jest.fn().mockReturnThis(),
    zodSchema: jest.fn().mockReturnThis(),
    optional: jest.fn().mockReturnThis(),
  },
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

jest.mock('@/lib/dataset.filter', () => ({
  DatasetFilterSchema: {},
}))

const { canUseDataset } = require('@/lib/dataset.access')
const { searchDataset } = require('@/lib/dataset.search')
const { makeJsonSafe } = require('@/lib/struct')

describe('/api/v1/dataset/[datasetId]/search', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockDataset = {
    id: 'dts_abc',
    userId: 'user_123',
    name: 'My Dataset',
  }

  const mockRecords = [
    { id: 'rec_1', text: 'Answer one', score: 0.9 },
    { id: 'rec_2', text: 'Answer two', score: 0.7 },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    makeJsonSafe.mockImplementation((v) => v)
  })

  describe('basic functionality', () => {
    it('should return search results for an authorized user', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      canUseDataset.mockResolvedValue(true)
      searchDataset.mockResolvedValue(mockRecords)

      const req = {
        query: { datasetId: 'dts_abc' },
      }

      const body = { search: 'password reset' }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'dts_abc', records: mockRecords })
    })

    it('should call searchDataset with userId, dataset, search text, and filter', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      canUseDataset.mockResolvedValue(true)
      searchDataset.mockResolvedValue([])

      const req = { query: { datasetId: 'dts_abc' } }
      const body = { search: 'my query', filter: { 'meta.type': 'faq' } }

      await handler(req, mockSession, body)

      expect(searchDataset).toHaveBeenCalledWith(
        'user_123',
        mockDataset,
        'my query',
        { 'meta.type': 'faq' }
      )
    })

    it('should pass records through makeJsonSafe', async () => {
      const rawRecords = [{ id: 'rec_1', score: 0.9 }]
      const safeRecords = [{ id: 'rec_1', score: 0.9, _safe: true }]

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      canUseDataset.mockResolvedValue(true)
      searchDataset.mockResolvedValue(rawRecords)
      makeJsonSafe.mockReturnValue(safeRecords)

      const req = { query: { datasetId: 'dts_abc' } }
      const body = { search: 'query' }

      const result = await handler(req, mockSession, body)

      expect(makeJsonSafe).toHaveBeenCalledWith(rawRecords)
      expect(result.body.records).toBe(safeRecords)
    })

    it('should return empty records array when no matches found', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      canUseDataset.mockResolvedValue(true)
      searchDataset.mockResolvedValue([])

      const req = { query: { datasetId: 'dts_abc' } }
      const body = { search: 'no match' }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'dts_abc', records: [] })
    })

    it('should look up the dataset using the URL param', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      canUseDataset.mockResolvedValue(true)
      searchDataset.mockResolvedValue([])

      const req = { query: { datasetId: 'dts_xyz' } }
      const body = { search: 'test' }

      await handler(req, mockSession, body)

      expect(prisma.dataset.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'dts_xyz'
      )
    })
  })

  describe('access control', () => {
    it('should return 404 when dataset is not found', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { datasetId: 'dts_missing' } }
      const body = { search: 'query' }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(404)
      expect(searchDataset).not.toHaveBeenCalled()
    })

    it('should return 403 when canUseDataset returns false', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      canUseDataset.mockResolvedValue(false)

      const req = { query: { datasetId: 'dts_abc' } }
      const body = { search: 'query' }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(403)
      expect(searchDataset).not.toHaveBeenCalled()
    })

    it('should check access with the correct user id and dataset', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      canUseDataset.mockResolvedValue(true)
      searchDataset.mockResolvedValue([])

      const req = { query: { datasetId: 'dts_abc' } }
      const body = { search: 'query' }

      await handler(req, mockSession, body)

      expect(canUseDataset).toHaveBeenCalledWith('user_123', mockDataset)
    })

    it('should allow access to a dataset owned by another user when canUseDataset returns true (public dataset)', async () => {
      const publicDataset = { id: 'dts_pub', userId: 'other_user' }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(publicDataset)
      canUseDataset.mockResolvedValue(true)
      searchDataset.mockResolvedValue([{ id: 'rec_1', score: 0.8 }])

      const req = { query: { datasetId: 'dts_pub' } }
      const body = { search: 'public query' }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('dts_pub')
    })
  })

  describe('error handling', () => {
    it('should propagate database error from findUniqueByIdentifier', async () => {
      const dbError = new Error('Database connection failed')

      prisma.dataset.findUniqueByIdentifier.mockRejectedValue(dbError)

      const req = { query: { datasetId: 'dts_abc' } }
      const body = { search: 'query' }

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should propagate error from searchDataset', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      canUseDataset.mockResolvedValue(true)
      searchDataset.mockRejectedValue(new Error('Vector search failed'))

      const req = { query: { datasetId: 'dts_abc' } }
      const body = { search: 'query' }

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'Vector search failed'
      )
    })
  })
})

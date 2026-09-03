/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './fetch'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    dataset: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((v) => v),
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
}))

const { makeJsonSafe } = require('@/lib/struct')

describe('/api/v1/dataset/[datasetId]/fetch', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockDataset = {
    id: 'dts_abc',
    name: 'My Dataset',
    description: 'A test dataset',
    userId: 'user_123',
    blueprintId: 'bp_xyz',
    reranker: 'rerank-v4-fast',
    recordMaxTokens: 1000,
    searchMinScore: 0.7,
    searchMaxRecords: 5,
    searchMaxTokens: 2000,
    matchInstruction: 'Use these records',
    mismatchInstruction: 'No records found',
    separators: '\n',
    visibility: 'private',
    meta: { key: 'value' },
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    makeJsonSafe.mockImplementation((v) => v)
  })

  describe('basic functionality', () => {
    it('should return dataset details for the owner', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...mockDataset,
      })

      const req = { query: { datasetId: 'dts_abc' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
    })

    it('should strip userId from the response for privacy', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...mockDataset,
      })

      const req = { query: { datasetId: 'dts_abc' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(200)
      expect(result.body).not.toHaveProperty('userId')
    })

    it('should pass the dataset through makeJsonSafe', async () => {
      const rawDataset = { ...mockDataset }
      const safeDataset = { ...rawDataset, userId: undefined, _safe: true }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(rawDataset)
      makeJsonSafe.mockReturnValue(safeDataset)

      const req = { query: { datasetId: 'dts_abc' } }

      const result = await handler(req, mockSession)

      expect(makeJsonSafe).toHaveBeenCalled()
      expect(result.body).toBe(safeDataset)
    })

    it('should look up the dataset using the URL param', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...mockDataset,
      })

      const req = { query: { datasetId: 'dts_xyz' } }

      await handler(req, mockSession)

      expect(prisma.dataset.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'dts_xyz',
        expect.objectContaining({ select: expect.any(Object) })
      )
    })

    it('should select specific fields (not select *)', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...mockDataset,
      })

      const req = { query: { datasetId: 'dts_abc' } }

      await handler(req, mockSession)

      const callArgs = prisma.dataset.findUniqueByIdentifier.mock.calls[0]
      const selectArg = callArgs[2]

      expect(selectArg).toHaveProperty('select')
      expect(selectArg.select).toHaveProperty('id', true)
      expect(selectArg.select).toHaveProperty('alias', true)
      expect(selectArg.select).toHaveProperty('visibility', true)
    })
  })

  describe('authorization', () => {
    it('should return 404 when dataset is not found', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { datasetId: 'dts_missing' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(404)
    })

    it('should return 403 when user does not own the dataset', async () => {
      const otherUsersDataset = { ...mockDataset, userId: 'other_user_999' }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(otherUsersDataset)

      const req = { query: { datasetId: 'dts_abc' } }

      const result = await handler(req, mockSession)

      expect(result.status).toBe(403)
    })

    it('should not return data when user does not own the dataset', async () => {
      const otherUsersDataset = { ...mockDataset, userId: 'other_user_999' }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(otherUsersDataset)

      const req = { query: { datasetId: 'dts_abc' } }

      const result = await handler(req, mockSession)

      expect(result.body).toBeUndefined()
      expect(makeJsonSafe).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should propagate database error from findUniqueByIdentifier', async () => {
      const dbError = new Error('Database connection failed')

      prisma.dataset.findUniqueByIdentifier.mockRejectedValue(dbError)

      const req = { query: { datasetId: 'dts_abc' } }

      await expect(handler(req, mockSession)).rejects.toThrow(
        'Database connection failed'
      )
    })
  })
})

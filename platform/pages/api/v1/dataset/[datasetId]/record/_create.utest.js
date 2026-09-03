/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { captureError } from '@/lib/error'
import { createRecord } from '@/lib/record'
import { getStore } from '@/lib/store.types'

import handler from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    dataset: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withSessionLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => {
  const schema = {
    object: jest.fn().mockReturnThis(),
  }

  return {
    __esModule: true,
    default: schema,
    withSchema: jest.fn((_schema, fn) => fn),
  }
})

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
  respondFromError: (err) => ({ status: 500, body: { message: err.message } }),
}))

jest.mock('@/lib/record', () => ({
  createRecord: jest.fn(),
}))

jest.mock('@/lib/store.types', () => ({
  getStore: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
}))

describe('POST /api/v1/dataset/[datasetId]/record/create', () => {
  const mockSession = {
    user: { id: 'user_123' },
  }

  const mockDataset = {
    id: 'dataset_abc',
    userId: 'user_123',
  }

  const mockStore = { type: 'default' }
  const mockBody = { text: 'Some record text' }

  beforeEach(() => {
    jest.clearAllMocks()
    getStore.mockResolvedValue(mockStore)
    createRecord.mockResolvedValue('record_new_id')
  })

  describe('dataset authorization', () => {
    it('should return 404 when dataset does not exist', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { datasetId: 'dataset_missing' } }
      const result = await handler(req, mockSession, mockBody)

      expect(result.status).toBe(404)
      expect(createRecord).not.toHaveBeenCalled()
    })

    it('should return 403 when dataset belongs to a different user', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...mockDataset,
        userId: 'other_user',
      })

      const req = { query: { datasetId: 'dataset_abc' } }
      const result = await handler(req, mockSession, mockBody)

      expect(result.status).toBe(403)
      expect(createRecord).not.toHaveBeenCalled()
    })
  })

  describe('record creation', () => {
    it('should return 200 with the new record id on success', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      createRecord.mockResolvedValue('record_new_id')

      const req = { query: { datasetId: 'dataset_abc' } }
      const result = await handler(req, mockSession, mockBody)

      expect(result.status).toBe(200)
      expect(result.body.id).toBe('record_new_id')
    })

    it('should call createRecord with the dataset id, store, and text from the body', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)

      const req = { query: { datasetId: 'dataset_abc' } }
      const body = { text: 'Record content', source: 'docs/guide.md' }

      await handler(req, mockSession, body)

      expect(createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          datasetId: 'dataset_abc',
          store: mockStore,
          text: 'Record content',
          source: 'docs/guide.md',
        })
      )
    })

    it('should call getStore with the dataset store configuration', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...mockDataset,
      })

      const req = { query: { datasetId: 'dataset_abc' } }

      await handler(req, mockSession, mockBody)

      expect(getStore).toHaveBeenCalledWith()
    })

    it('should pass meta when provided in the body', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)

      const req = { query: { datasetId: 'dataset_abc' } }
      const body = {
        text: 'Some text',
        meta: { category: 'support', priority: 1 },
      }

      await handler(req, mockSession, body)

      expect(createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: { category: 'support', priority: 1 },
        })
      )
    })
  })

  describe('error handling', () => {
    it('should return 500 and capture the error when createRecord throws', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)

      const recordError = new Error('Vector store unavailable')

      createRecord.mockRejectedValue(recordError)

      const req = { query: { datasetId: 'dataset_abc' } }
      const result = await handler(req, mockSession, mockBody)

      expect(result.status).toBe(500)
      expect(captureError).toHaveBeenCalledWith(recordError)
    })

    it('should return 500 and capture the error when getStore throws', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)

      const storeError = new Error('Unknown store type')

      getStore.mockRejectedValue(storeError)

      const req = { query: { datasetId: 'dataset_abc' } }
      const result = await handler(req, mockSession, mockBody)

      expect(result.status).toBe(500)
      expect(captureError).toHaveBeenCalledWith(storeError)
    })

    it('should propagate dataset lookup errors', async () => {
      prisma.dataset.findUniqueByIdentifier.mockRejectedValue(
        new Error('DB timeout')
      )

      const req = { query: { datasetId: 'dataset_abc' } }

      await expect(handler(req, mockSession, mockBody)).rejects.toThrow(
        'DB timeout'
      )
    })
  })
})

/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler, { bodySchema } from './update'

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

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  ...jest.requireActual('@/lib/joi.handler'),
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 403 }),
  ok: (data) => ({ status: 200, ...data }),
  respondFromError: (e) => ({ status: 500, error: e }),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

const mockStore = {
  accessRecord: jest.fn(),
}

jest.mock('@/lib/store.types', () => ({
  getStore: jest.fn(),
}))

jest.mock('@/lib/record', () => ({
  updateRecord: jest.fn(),
}))

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((newMeta, existingMeta) => newMeta ?? existingMeta),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
}))

const { getStore } = require('@/lib/store.types')
const { updateRecord } = require('@/lib/record')
const { captureError } = require('@/lib/error')

describe('POST /api/v1/dataset/{datasetId}/record/{recordId}/update', () => {
  const mockSession = { user: { id: 'user-123' } }

  const mockDataset = {
    id: 'dataset-abc',
    userId: 'user-123',
  }

  const mockExistingRecord = {
    id: 'record-xyz',
    text: 'Original text',
    meta: { tag: 'original' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getStore.mockResolvedValue(mockStore)
    mockStore.accessRecord.mockResolvedValue(mockExistingRecord)
    updateRecord.mockResolvedValue(undefined)
  })

  describe('authorization', () => {
    it('should return 404 when the dataset does not exist', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)

      const req = { query: { datasetId: 'missing-ds', recordId: 'rec-1' } }
      const result = await handler(req, mockSession, {})

      expect(result.status).toBe(404)
    })

    it('should return 403 when the dataset belongs to a different user', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...mockDataset,
        userId: 'other-user-456',
      })

      const req = { query: { datasetId: 'dataset-abc', recordId: 'rec-1' } }
      const result = await handler(req, mockSession, {})

      expect(result.status).toBe(403)
    })
  })

  describe('record not found', () => {
    it('should return 404 when the record does not exist in the store', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      mockStore.accessRecord.mockRejectedValue(new Error('Record not found'))

      const req = {
        query: { datasetId: 'dataset-abc', recordId: 'missing-rec' },
      }
      const result = await handler(req, mockSession, {})

      expect(result.status).toBe(404)
    })
  })

  describe('successful update', () => {
    it('should return 200 with the record id on success', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)

      const req = {
        query: { datasetId: 'dataset-abc', recordId: 'record-xyz' },
      }
      const body = { text: 'Updated text' }
      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.id).toBe('record-xyz')
    })

    it('should call updateRecord with the correct arguments', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)

      const req = {
        query: { datasetId: 'dataset-abc', recordId: 'record-xyz' },
      }
      const body = { text: 'New text', source: 'docs.md', meta: { key: 'val' } }

      await handler(req, mockSession, body)

      expect(updateRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          datasetId: 'dataset-abc',
          recordId: 'record-xyz',
          store: mockStore,
          text: 'New text',
          source: 'docs.md',
        })
      )
    })

    it('should merge meta from the body with the existing record meta', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)

      const { getMeta } = require('@/lib/meta')

      const req = {
        query: { datasetId: 'dataset-abc', recordId: 'record-xyz' },
      }
      const body = { meta: { newKey: 'newVal' } }

      await handler(req, mockSession, body)

      // getMeta should be called with the new meta and the existing record's meta
      expect(getMeta).toHaveBeenCalledWith(
        { newKey: 'newVal' },
        mockExistingRecord.meta
      )
    })
  })

  describe('error handling', () => {
    it('should capture and respond with the error when updateRecord throws', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)

      const error = new Error('Store write failure')

      updateRecord.mockRejectedValue(error)

      const req = {
        query: { datasetId: 'dataset-abc', recordId: 'record-xyz' },
      }
      const result = await handler(req, mockSession, { text: 'text' })

      expect(captureError).toHaveBeenCalledWith(error)
      expect(result.status).toBe(500)
    })
  })

  describe('bodySchema', () => {
    it('should accept a valid text field', () => {
      const { error } = bodySchema.validate({ text: 'Some record text' })

      expect(error).toBeUndefined()
    })

    it('should accept an empty body (all fields optional)', () => {
      const { error } = bodySchema.validate({})

      expect(error).toBeUndefined()
    })
  })
})

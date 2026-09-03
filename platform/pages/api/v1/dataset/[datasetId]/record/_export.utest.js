/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './export'

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

const mockStore = {
  listRecords: jest.fn(),
}

jest.mock('@/lib/store.types', () => ({
  getStore: jest.fn(() => Promise.resolve(mockStore)),
}))

jest.mock('@/lib/method', () => ({
  withGet: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/stream', () => ({
  withStreamCursor: (fn) => (cursor, req, stream, session) =>
    fn(cursor, req, stream, session),
}))

jest.mock('@/lib/filter', () => ({
  getTakeConstraints: jest.fn(() => ({ take: 10 })),
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  throwNotAuthorized: jest.fn(() => {
    throw Object.assign(new Error('Not Authorized'), { status: 401 })
  }),
  throwNotFound: jest.fn(() => {
    throw Object.assign(new Error('Not Found'), { status: 404 })
  }),
}))

const { throwNotAuthorized, throwNotFound } = require('@/lib/response')
const { getStore } = require('@/lib/store.types')
const { getTakeConstraints } = require('@/lib/filter')

describe('GET /api/v1/dataset/[datasetId]/record/export', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { datasetId: 'dataset-1' } }

  const mockDataset = {
    id: 'dataset-1',
    userId: 'user-1',
  }

  const mockRecord = {
    id: 'record-1',
    text: 'Sample text content',
    source: 'https://example.com',
    meta: { category: 'docs', priority: 1 },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getTakeConstraints.mockReturnValue({ take: 10 })
    getStore.mockResolvedValue(mockStore)
    mockStore.listRecords.mockResolvedValue({
      records: [],
      nextCursor: undefined,
    })
  })

  describe('authorization', () => {
    it('throws not found when dataset does not exist', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)

      await expect(handler(null, req, null, session)).rejects.toMatchObject({
        status: 404,
      })
      expect(throwNotFound).toHaveBeenCalled()
      expect(mockStore.listRecords).not.toHaveBeenCalled()
    })

    it('throws not authorized when dataset is owned by another user', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        id: 'dataset-1',
        userId: 'user-2',
      })

      await expect(handler(null, req, null, session)).rejects.toMatchObject({
        status: 401,
      })
      expect(throwNotAuthorized).toHaveBeenCalled()
      expect(mockStore.listRecords).not.toHaveBeenCalled()
    })

    it('proceeds when dataset belongs to the requesting user', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)

      const result = await handler(null, req, null, session)

      expect(result.items).toBeDefined()
    })
  })

  describe('cursor passthrough', () => {
    it('returns null cursor when store has no next page', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      mockStore.listRecords.mockResolvedValue({
        records: [],
        nextCursor: undefined,
      })

      const result = await handler(null, req, null, session)

      // @note Must be null, not undefined, so withStreamCursor stops iteration.
      // If undefined is returned, withStreamCursor falls back to CUID-based cursor
      // which Qdrant and other vector stores reject.
      expect(result.cursor).toBeNull()
    })

    it('returns null cursor when store explicitly returns null', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      mockStore.listRecords.mockResolvedValue({
        records: [],
        nextCursor: null,
      })

      const result = await handler(null, req, null, session)

      expect(result.cursor).toBeNull()
    })

    it('passes the store cursor through when there are more pages', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      mockStore.listRecords.mockResolvedValue({
        records: [mockRecord],
        nextCursor: 'store-cursor-abc123',
      })

      const result = await handler(null, req, null, session)

      expect(result.cursor).toBe('store-cursor-abc123')
    })

    it('forwards the incoming cursor to the store', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      mockStore.listRecords.mockResolvedValue({
        records: [],
        nextCursor: null,
      })

      await handler('existing-cursor', req, null, session)

      expect(mockStore.listRecords).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: 'existing-cursor' })
      )
    })

    it('passes initial null cursor to the store on first call', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      mockStore.listRecords.mockResolvedValue({
        records: [],
        nextCursor: null,
      })

      await handler(null, req, null, session)

      expect(mockStore.listRecords).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: null })
      )
    })
  })

  describe('record mapping', () => {
    it('maps records to the expected shape', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      mockStore.listRecords.mockResolvedValue({
        records: [mockRecord],
        nextCursor: null,
      })

      const result = await handler(null, req, null, session)

      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({
        id: 'record-1',
        text: 'Sample text content',
        source: 'https://example.com',
        createdAt: mockRecord.createdAt,
        updatedAt: mockRecord.updatedAt,
      })
    })

    it('returns empty items array when there are no records', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      mockStore.listRecords.mockResolvedValue({
        records: [],
        nextCursor: null,
      })

      const result = await handler(null, req, null, session)

      expect(result.items).toEqual([])
    })
  })

  describe('meta proxy', () => {
    it('returns meta values via proxy for normal property access', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      mockStore.listRecords.mockResolvedValue({
        records: [mockRecord],
        nextCursor: null,
      })

      const result = await handler(null, req, null, session)

      expect(result.items[0].meta.category).toBe('docs')
      expect(result.items[0].meta.priority).toBe(1)
    })

    it('returns YAML stringification via toString() on the meta proxy', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      mockStore.listRecords.mockResolvedValue({
        records: [{ ...mockRecord, meta: { key: 'value', count: 42 } }],
        nextCursor: null,
      })

      const result = await handler(null, req, null, session)

      const yamlString = result.items[0].meta.toString()

      expect(typeof yamlString).toBe('string')
      // YAML output should contain the key
      expect(yamlString).toContain('key')
      expect(yamlString).toContain('value')
    })

    it('returns undefined meta when record has no meta', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      mockStore.listRecords.mockResolvedValue({
        records: [{ ...mockRecord, meta: null }],
        nextCursor: null,
      })

      const result = await handler(null, req, null, session)

      expect(result.items[0].meta).toBeUndefined()
    })
  })

  describe('store interaction', () => {
    it('calls getStore with the dataset store type', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)

      await handler(null, req, null, session)

      expect(getStore).toHaveBeenCalledWith()
    })

    it('passes the dataset id to listRecords', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)

      await handler(null, req, null, session)

      expect(mockStore.listRecords).toHaveBeenCalledWith(
        expect.objectContaining({ datasetId: 'dataset-1' })
      )
    })

    it('passes take constraints from the request to listRecords', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      getTakeConstraints.mockReturnValue({ take: 25 })

      await handler(null, req, null, session)

      expect(mockStore.listRecords).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 25 })
      )
    })
  })

  describe('error handling', () => {
    it('propagates database error from findUniqueByIdentifier', async () => {
      prisma.dataset.findUniqueByIdentifier.mockRejectedValue(
        new Error('DB connection failed')
      )

      await expect(handler(null, req, null, session)).rejects.toThrow(
        'DB connection failed'
      )
    })

    it('propagates error from getStore', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      getStore.mockRejectedValue(new Error('Unknown store type'))

      await expect(handler(null, req, null, session)).rejects.toThrow(
        'Unknown store type'
      )
    })

    it('propagates error from listRecords', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      mockStore.listRecords.mockRejectedValue(new Error('Vector store timeout'))

      await expect(handler(null, req, null, session)).rejects.toThrow(
        'Vector store timeout'
      )
    })
  })
})

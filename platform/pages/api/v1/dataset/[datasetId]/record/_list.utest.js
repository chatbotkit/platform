/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { getStore } from '@/lib/store.types'

import handler from './list'

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
  throwNotFound: jest.fn((msg) => {
    throw Object.assign(new Error(msg), { status: 404 })
  }),
}))

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((v) => v),
}))

jest.mock('@/lib/store.types', () => ({
  getStore: jest.fn(),
}))

const { getTakeConstraints } = require('@/lib/filter')
const { throwNotAuthorized, throwNotFound } = require('@/lib/response')

describe('GET /api/v1/dataset/[datasetId]/record/list', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { datasetId: 'dataset-1' } }

  const mockDataset = {
    id: 'dataset-1',
    userId: 'user-1',
  }

  const mockRecords = [
    {
      id: 'rec-1',
      text: 'First record',
      source: 'doc1.md',
      meta: {},
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
    },
    {
      id: 'rec-2',
      text: 'Second record',
      source: 'doc2.md',
      meta: { tag: 'faq' },
      createdAt: new Date('2024-01-03'),
      updatedAt: new Date('2024-01-04'),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    getTakeConstraints.mockReturnValue({ take: 10 })
  })

  describe('authorization', () => {
    it('throws not found when dataset does not exist', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)

      await expect(handler(null, req, null, session)).rejects.toThrow(
        'Dataset not found'
      )

      expect(throwNotFound).toHaveBeenCalledWith('Dataset not found')
      expect(getStore).not.toHaveBeenCalled()
    })

    it('throws not authorized when dataset belongs to another user', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...mockDataset,
        userId: 'user-2',
      })

      await expect(handler(null, req, null, session)).rejects.toMatchObject({
        status: 401,
      })

      expect(throwNotAuthorized).toHaveBeenCalled()
      expect(getStore).not.toHaveBeenCalled()
    })
  })

  describe('record listing', () => {
    it('returns records with the store cursor when more pages are available', async () => {
      const store = {
        listRecords: jest.fn().mockResolvedValue({
          records: mockRecords,
          nextCursor: 'next-page-cursor',
        }),
      }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      getStore.mockResolvedValue(store)

      const result = await handler(null, req, null, session)

      expect(result.cursor).toBe('next-page-cursor')
      expect(result.items).toHaveLength(2)
    })

    it('returns null cursor (not undefined) when store has no more pages', async () => {
      // @note returning null explicitly signals withStreamCursor to stop
      // iterating; undefined causes it to fall back to CUID-based cursor
      // which vector stores (e.g. Qdrant) reject
      const store = {
        listRecords: jest.fn().mockResolvedValue({
          records: mockRecords,
          nextCursor: undefined,
        }),
      }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      getStore.mockResolvedValue(store)

      const result = await handler(null, req, null, session)

      expect(result.cursor).toBeNull()
      expect(result.cursor).not.toBeUndefined()
    })

    it('propagates an explicit null cursor from the store unchanged', async () => {
      const store = {
        listRecords: jest.fn().mockResolvedValue({
          records: [],
          nextCursor: null,
        }),
      }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      getStore.mockResolvedValue(store)

      const result = await handler(null, req, null, session)

      expect(result.cursor).toBeNull()
    })

    it('maps record fields correctly', async () => {
      const store = {
        listRecords: jest.fn().mockResolvedValue({
          records: [mockRecords[0]],
          nextCursor: null,
        }),
      }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      getStore.mockResolvedValue(store)

      const result = await handler(null, req, null, session)

      expect(result.items[0]).toMatchObject({
        id: 'rec-1',
        text: 'First record',
        source: 'doc1.md',
        meta: {},
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      })
    })

    it('passes cursor and take constraints to the store', async () => {
      const store = {
        listRecords: jest.fn().mockResolvedValue({
          records: [],
          nextCursor: null,
        }),
      }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...mockDataset,
        id: 'resolved-dataset-id',
      })
      getStore.mockResolvedValue(store)

      getTakeConstraints.mockReturnValue({ take: 25 })

      await handler('cursor-abc', req, null, session)

      expect(store.listRecords).toHaveBeenCalledWith({
        datasetId: 'resolved-dataset-id',
        cursor: 'cursor-abc',
        limit: 25,
      })
    })

    it('uses resolved dataset id (not the raw query param) for store calls', async () => {
      const store = {
        listRecords: jest.fn().mockResolvedValue({
          records: [],
          nextCursor: null,
        }),
      }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...mockDataset,
        id: 'internal-dataset-id',
      })
      getStore.mockResolvedValue(store)

      const reqWithAlias = { query: { datasetId: 'some-alias' } }

      await handler(null, reqWithAlias, null, session)

      expect(store.listRecords).toHaveBeenCalledWith(
        expect.objectContaining({ datasetId: 'internal-dataset-id' })
      )
    })

    it('calls getStore with the dataset store configuration', async () => {
      const store = {
        listRecords: jest.fn().mockResolvedValue({
          records: [],
          nextCursor: null,
        }),
      }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...mockDataset,
      })
      getStore.mockResolvedValue(store)

      await handler(null, req, null, session)

      expect(getStore).toHaveBeenCalledWith()
    })

    it('returns an empty items array when there are no records', async () => {
      const store = {
        listRecords: jest.fn().mockResolvedValue({
          records: [],
          nextCursor: null,
        }),
      }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      getStore.mockResolvedValue(store)

      const result = await handler(null, req, null, session)

      expect(result.items).toEqual([])
      expect(result.cursor).toBeNull()
    })
  })
})

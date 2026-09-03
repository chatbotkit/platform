/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './list'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      dataset: {
        findUniqueByIdentifier: jest.fn(),
      },
      datasetFileAttachment: {
        findMany: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

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
  getMetaQueryFilter: jest.fn(() => []),
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

jest.mock('@/lib/struct', () => ({
  makeJsonSafe: jest.fn((v) => v),
}))

const { throwNotAuthorized, throwNotFound } = require('@/lib/response')
const { getMetaQueryFilter, getTakeConstraints } = require('@/lib/filter')
const { makeJsonSafe } = require('@/lib/struct')

describe('GET /api/v1/dataset/[datasetId]/file/list', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { datasetId: 'dataset-1' } }

  const mockDataset = {
    id: 'dataset-1',
    userId: 'user-1',
  }

  const mockFiles = [
    {
      file: {
        id: 'file-1',
        name: 'document.pdf',
        description: 'A test document',
        visibility: 'private',
        meta: {},
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      },
    },
    {
      file: {
        id: 'file-2',
        name: 'image.png',
        description: 'A test image',
        visibility: 'public',
        meta: { category: 'images' },
        createdAt: new Date('2024-01-03'),
        updatedAt: new Date('2024-01-04'),
      },
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    makeJsonSafe.mockImplementation((v) => v)
    getTakeConstraints.mockReturnValue({ take: 10 })
    getMetaQueryFilter.mockReturnValue([])
  })

  describe('authorization', () => {
    it('throws not found when dataset does not exist', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)

      await expect(handler(null, req, null, session)).rejects.toMatchObject({
        status: 404,
      })
      expect(throwNotFound).toHaveBeenCalled()
      expect(prisma.datasetFileAttachment.findMany).not.toHaveBeenCalled()
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
      expect(prisma.datasetFileAttachment.findMany).not.toHaveBeenCalled()
    })

    it('returns files for the dataset owner', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      prisma.datasetFileAttachment.findMany.mockResolvedValue(mockFiles)

      const result = await handler(null, req, null, session)

      expect(result.items).toEqual([mockFiles[0].file, mockFiles[1].file])
    })
  })

  describe('dataset id defense in depth', () => {
    it('queries files using the dataset.id to scope the result correctly', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      prisma.datasetFileAttachment.findMany.mockResolvedValue([])

      await handler(null, req, null, session)

      expect(prisma.datasetFileAttachment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ datasetId: 'dataset-1' }]),
          }),
        })
      )
    })

    it('selects the dataset id field when looking up the dataset', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      prisma.datasetFileAttachment.findMany.mockResolvedValue([])

      await handler(null, req, null, session)

      expect(prisma.dataset.findUniqueByIdentifier).toHaveBeenCalledWith(
        session.user,
        'dataset-1',
        expect.objectContaining({
          select: expect.objectContaining({ id: true }),
        })
      )
    })
  })

  describe('response shape', () => {
    it('unwraps file from attachment relation and returns flat file array', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      prisma.datasetFileAttachment.findMany.mockResolvedValue(mockFiles)

      const result = await handler(null, req, null, session)

      expect(result.items).toHaveLength(2)
      expect(result.items[0]).toEqual(mockFiles[0].file)
      expect(result.items[1]).toEqual(mockFiles[1].file)
    })

    it('returns empty array when no files are attached', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      prisma.datasetFileAttachment.findMany.mockResolvedValue([])

      const result = await handler(null, req, null, session)

      expect(result.items).toEqual([])
    })

    it('passes file list through makeJsonSafe', async () => {
      const safeFiles = [{ id: 'safe-file-1' }]

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      prisma.datasetFileAttachment.findMany.mockResolvedValue(mockFiles)
      makeJsonSafe.mockReturnValue(safeFiles)

      const result = await handler(null, req, null, session)

      expect(makeJsonSafe).toHaveBeenCalledWith([
        mockFiles[0].file,
        mockFiles[1].file,
      ])
      expect(result.items).toBe(safeFiles)
    })
  })

  describe('filtering and pagination', () => {
    it('applies take constraints from the request', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      prisma.datasetFileAttachment.findMany.mockResolvedValue([])
      getTakeConstraints.mockReturnValue({ take: 5 })

      await handler(null, req, null, session)

      expect(prisma.datasetFileAttachment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      )
    })

    it('applies meta query filters from the request', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      prisma.datasetFileAttachment.findMany.mockResolvedValue([])
      getMetaQueryFilter.mockReturnValue([{ 'meta.category': 'docs' }])

      await handler(null, req, null, session)

      expect(prisma.datasetFileAttachment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([{ 'meta.category': 'docs' }]),
          }),
        })
      )
    })

    it('uses requiredUrlParam to read datasetId from the request', async () => {
      const reqWithDifferentId = { query: { datasetId: 'ds-xyz' } }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        id: 'ds-xyz',
        userId: 'user-1',
      })
      prisma.datasetFileAttachment.findMany.mockResolvedValue([])

      await handler(null, reqWithDifferentId, null, session)

      expect(prisma.dataset.findUniqueByIdentifier).toHaveBeenCalledWith(
        session.user,
        'ds-xyz',
        expect.any(Object)
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

    it('propagates database error from datasetFileAttachment.findMany', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      prisma.datasetFileAttachment.findMany.mockRejectedValue(
        new Error('Query failed')
      )

      await expect(handler(null, req, null, session)).rejects.toThrow(
        'Query failed'
      )
    })
  })
})

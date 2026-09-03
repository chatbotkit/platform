/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './attach'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    dataset: {
      findUniqueByIdentifier: jest.fn(),
    },
    file: {
      findUniqueByIdentifier: jest.fn(),
    },
    datasetFileAttachment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

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

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

describe('POST /api/v1/dataset/[datasetId]/file/[fileId]/attach', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { datasetId: 'dataset-1', fileId: 'file-1' } }
  const body = { type: 'source' }

  const mockDataset = { id: 'dataset-1', userId: 'user-1' }
  const mockFile = { id: 'file-1', userId: 'user-1' }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.datasetFileAttachment.findUnique.mockResolvedValue(null)
    prisma.datasetFileAttachment.create.mockResolvedValue({})
  })

  describe('authorization - dataset', () => {
    it('returns 404 when dataset does not exist', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(req, session, body)

      expect(result).toEqual({ status: 404 })
      expect(prisma.file.findUniqueByIdentifier).not.toHaveBeenCalled()
    })

    it('returns 401 when dataset belongs to another user', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...mockDataset,
        userId: 'user-2',
      })

      const result = await handler(req, session, body)

      expect(result).toEqual({ status: 401 })
      expect(prisma.file.findUniqueByIdentifier).not.toHaveBeenCalled()
    })
  })

  describe('authorization - file', () => {
    it('returns 404 when file does not exist', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      prisma.file.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(req, session, body)

      expect(result).toEqual({ status: 404 })
      expect(prisma.datasetFileAttachment.findUnique).not.toHaveBeenCalled()
    })

    it('returns 401 when file belongs to another user', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      prisma.file.findUniqueByIdentifier.mockResolvedValue({
        ...mockFile,
        userId: 'user-2',
      })

      const result = await handler(req, session, body)

      expect(result).toEqual({ status: 401 })
      expect(prisma.datasetFileAttachment.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('creating a new attachment', () => {
    beforeEach(() => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      prisma.file.findUniqueByIdentifier.mockResolvedValue(mockFile)
    })

    it('creates attachment when none exists and returns 200', async () => {
      prisma.datasetFileAttachment.findUnique.mockResolvedValue(null)

      const result = await handler(req, session, body)

      expect(prisma.datasetFileAttachment.delete).not.toHaveBeenCalled()
      expect(prisma.datasetFileAttachment.create).toHaveBeenCalledWith({
        data: {
          datasetId: 'dataset-1',
          fileId: 'file-1',
          type: 'source',
        },
      })
      expect(result.status).toBe(200)
      expect(result.body).toEqual({
        id: 'file-1',
        datasetId: 'dataset-1',
        type: 'source',
      })
    })

    it('checks attachment using the resolved dataset and file IDs', async () => {
      await handler(req, session, body)

      expect(prisma.datasetFileAttachment.findUnique).toHaveBeenCalledWith({
        where: {
          datasetId_fileId: {
            datasetId: 'dataset-1',
            fileId: 'file-1',
          },
        },
      })
    })
  })

  describe('re-attaching an existing attachment', () => {
    beforeEach(() => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(mockDataset)
      prisma.file.findUniqueByIdentifier.mockResolvedValue(mockFile)
    })

    it('deletes existing attachment before creating a new one', async () => {
      prisma.datasetFileAttachment.findUnique.mockResolvedValue({
        datasetId: 'dataset-1',
        fileId: 'file-1',
        type: 'source',
      })

      const result = await handler(req, session, body)

      expect(prisma.datasetFileAttachment.delete).toHaveBeenCalledWith({
        where: {
          datasetId_fileId: {
            datasetId: 'dataset-1',
            fileId: 'file-1',
          },
        },
      })
      expect(prisma.datasetFileAttachment.create).toHaveBeenCalled()
      expect(result.status).toBe(200)
    })

    it('delete is called before create when re-attaching', async () => {
      const callOrder = []

      prisma.datasetFileAttachment.findUnique.mockResolvedValue({
        datasetId: 'dataset-1',
        fileId: 'file-1',
        type: 'source',
      })
      prisma.datasetFileAttachment.delete.mockImplementation(() => {
        callOrder.push('delete')

        return Promise.resolve({})
      })
      prisma.datasetFileAttachment.create.mockImplementation(() => {
        callOrder.push('create')

        return Promise.resolve({})
      })

      await handler(req, session, body)

      expect(callOrder).toEqual(['delete', 'create'])
    })
  })
})

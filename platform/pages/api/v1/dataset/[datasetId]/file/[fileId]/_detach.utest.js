/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { getStore } from '@/lib/store.types'

import handler from './detach'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    datasetFileAttachment: {
      findFirst: jest.fn(),
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

jest.mock('@/lib/store.types', () => ({
  getStore: jest.fn(),
}))

describe('POST /api/v1/dataset/[datasetId]/file/[fileId]/detach', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { datasetId: 'dataset-1', fileId: 'file-1' } }

  const mockAttachment = {
    datasetId: 'dataset-1',
    fileId: 'file-1',
    type: 'source',
    dataset: { id: 'dataset-1', userId: 'user-1' },
    file: { id: 'file-1', userId: 'user-1' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    prisma.datasetFileAttachment.delete.mockResolvedValue({})
  })

  describe('when attachment is not found', () => {
    it('returns 404 when attachment does not exist', async () => {
      prisma.datasetFileAttachment.findFirst.mockResolvedValue(null)

      const result = await handler(req, session, { deleteRecords: false })

      expect(result).toEqual({ status: 404 })
      expect(prisma.datasetFileAttachment.delete).not.toHaveBeenCalled()
    })
  })

  describe('when dataset is missing from attachment', () => {
    it('returns 404 when attachment has no dataset', async () => {
      prisma.datasetFileAttachment.findFirst.mockResolvedValue({
        ...mockAttachment,
        dataset: null,
      })

      const result = await handler(req, session, { deleteRecords: false })

      expect(result).toEqual({ status: 404 })
    })
  })

  describe('authorization - dataset', () => {
    it('returns 401 when dataset belongs to another user', async () => {
      prisma.datasetFileAttachment.findFirst.mockResolvedValue({
        ...mockAttachment,
        dataset: { ...mockAttachment.dataset, userId: 'user-2' },
      })

      const result = await handler(req, session, { deleteRecords: false })

      expect(result).toEqual({ status: 401 })
      expect(prisma.datasetFileAttachment.delete).not.toHaveBeenCalled()
    })
  })

  describe('when file is missing from attachment', () => {
    it('returns 404 when attachment has no file', async () => {
      prisma.datasetFileAttachment.findFirst.mockResolvedValue({
        ...mockAttachment,
        file: null,
      })

      const result = await handler(req, session, { deleteRecords: false })

      expect(result).toEqual({ status: 404 })
    })
  })

  describe('authorization - file', () => {
    it('returns 401 when file belongs to another user', async () => {
      prisma.datasetFileAttachment.findFirst.mockResolvedValue({
        ...mockAttachment,
        file: { ...mockAttachment.file, userId: 'user-2' },
      })

      const result = await handler(req, session, { deleteRecords: false })

      expect(result).toEqual({ status: 401 })
      expect(prisma.datasetFileAttachment.delete).not.toHaveBeenCalled()
    })
  })

  describe('detaching without record deletion', () => {
    beforeEach(() => {
      prisma.datasetFileAttachment.findFirst.mockResolvedValue(mockAttachment)
    })

    it('deletes the attachment and returns the file id', async () => {
      const result = await handler(req, session, { deleteRecords: false })

      expect(prisma.datasetFileAttachment.delete).toHaveBeenCalledWith({
        where: {
          datasetId_fileId: {
            datasetId: 'dataset-1',
            fileId: 'file-1',
          },
        },
      })
      expect(result.status).toBe(200)
      expect(result.body).toEqual({
        id: 'file-1',
        datasetId: 'dataset-1',
        type: 'source',
      })
    })

    it('does not call getStore when deleteRecords is false', async () => {
      await handler(req, session, { deleteRecords: false })

      expect(getStore).not.toHaveBeenCalled()
    })

    it('does not call getStore when deleteRecords is omitted', async () => {
      await handler(req, session, {})

      expect(getStore).not.toHaveBeenCalled()
    })
  })

  describe('detaching with record deletion', () => {
    const mockStore = {
      deleteRecordsBySource: jest.fn().mockResolvedValue(undefined),
    }

    beforeEach(() => {
      prisma.datasetFileAttachment.findFirst.mockResolvedValue(mockAttachment)
      getStore.mockResolvedValue(mockStore)
    })

    it('deletes records matching the file source URI before removing the attachment', async () => {
      await handler(req, session, { deleteRecords: true })

      expect(getStore).toHaveBeenCalledWith()
      expect(mockStore.deleteRecordsBySource).toHaveBeenCalledWith({
        datasetId: 'dataset-1',
        source: 'file:///file-1',
      })
      expect(prisma.datasetFileAttachment.delete).toHaveBeenCalled()
    })

    it('returns 200 with attachment details after deleting records', async () => {
      const result = await handler(req, session, { deleteRecords: true })

      expect(result.status).toBe(200)
      expect(result.body).toEqual({
        id: 'file-1',
        datasetId: 'dataset-1',
        type: 'source',
      })
    })

    it('constructs the source URI as file:///fileId', async () => {
      const req2 = { query: { datasetId: 'dataset-1', fileId: 'abc-xyz-789' } }
      const attachment2 = {
        ...mockAttachment,
        fileId: 'abc-xyz-789',
        file: { id: 'abc-xyz-789', userId: 'user-1' },
      }

      prisma.datasetFileAttachment.findFirst.mockResolvedValue(attachment2)

      await handler(req2, session, { deleteRecords: true })

      expect(mockStore.deleteRecordsBySource).toHaveBeenCalledWith({
        datasetId: 'dataset-1',
        source: 'file:///abc-xyz-789',
      })
    })
  })
})

/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import handler from './sync'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    datasetFileAttachment: {
      findFirst: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/rate', () => ({
  withSessionRate: (_n, _window, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, key) => req.query[key]),
}))

jest.mock('@/lib/response', () => ({
  ok: (body) => ({ status: 200, body }),
  notFound: () => ({ status: 404 }),
  notAuthorized: () => ({ status: 401 }),
}))

jest.mock('@/pages/api/v1/dataset/[datasetId]/queue', () => ({
  sendEvent: jest.fn().mockResolvedValue(undefined),
}))

/* eslint-disable @typescript-eslint/no-require-imports */
const { sendEvent } = require('@/pages/api/v1/dataset/[datasetId]/queue')

describe('POST /api/v1/dataset/[datasetId]/file/[fileId]/sync', () => {
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
  })

  describe('when attachment does not exist', () => {
    it('returns 404', async () => {
      prisma.datasetFileAttachment.findFirst.mockResolvedValue(null)

      const result = await handler(req, session)

      expect(result).toEqual({ status: 404 })
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('when dataset is missing from attachment', () => {
    it('returns 404', async () => {
      prisma.datasetFileAttachment.findFirst.mockResolvedValue({
        ...mockAttachment,
        dataset: null,
      })

      const result = await handler(req, session)

      expect(result).toEqual({ status: 404 })
    })
  })

  describe('authorization - dataset', () => {
    it('returns 401 when dataset belongs to another user', async () => {
      prisma.datasetFileAttachment.findFirst.mockResolvedValue({
        ...mockAttachment,
        dataset: { ...mockAttachment.dataset, userId: 'user-2' },
      })

      const result = await handler(req, session)

      expect(result).toEqual({ status: 401 })
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('when file is missing from attachment', () => {
    it('returns 404', async () => {
      prisma.datasetFileAttachment.findFirst.mockResolvedValue({
        ...mockAttachment,
        file: null,
      })

      const result = await handler(req, session)

      expect(result).toEqual({ status: 404 })
    })
  })

  describe('authorization - file', () => {
    it('returns 401 when file belongs to another user', async () => {
      prisma.datasetFileAttachment.findFirst.mockResolvedValue({
        ...mockAttachment,
        file: { ...mockAttachment.file, userId: 'user-2' },
      })

      const result = await handler(req, session)

      expect(result).toEqual({ status: 401 })
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('successful sync', () => {
    beforeEach(() => {
      prisma.datasetFileAttachment.findFirst.mockResolvedValue(mockAttachment)
    })

    it('sends an importFile event to the dataset queue', async () => {
      await handler(req, session)

      expect(sendEvent).toHaveBeenCalledWith('dataset-1', {
        type: 'importFile',
        payload: {
          fileId: 'file-1',
        },
      })
    })

    it('returns 200 with the file id', async () => {
      const result = await handler(req, session)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'file-1' })
    })

    it('looks up the attachment using both datasetId and fileId from the request', async () => {
      await handler(req, session)

      expect(prisma.datasetFileAttachment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            datasetId: 'dataset-1',
            fileId: 'file-1',
          }),
        })
      )
    })
  })
})

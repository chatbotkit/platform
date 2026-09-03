/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './sync'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    file: {
      findUniqueByIdentifier: jest.fn(),
    },
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/rate', () => ({
  withSessionRate: (_count, _window, fn) => fn,
}))

jest.mock('@/lib/query.get', () => ({
  requiredUrlParam: jest.fn((req, param) => req.query[param]),
}))

jest.mock('@/lib/response', () => ({
  ok: jest.fn((data) => ({ status: 200, body: data })),
  notFound: jest.fn(() => ({ status: 404 })),
  notAuthorized: jest.fn(() => ({ status: 401 })),
}))

jest.mock('@/pages/api/v1/dataset/[datasetId]/queue', () => ({
  sendEvent: jest.fn(),
}))

const { sendEvent } = require('@/pages/api/v1/dataset/[datasetId]/queue')
const { ok, notFound, notAuthorized } = require('@/lib/response')

describe('POST /api/v1/file/{fileId}/sync', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const makeReq = (fileId) => ({ query: { fileId } })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('successful sync', () => {
    it('should return the file id after queuing sync events for all datasets', async () => {
      prisma.file.findUniqueByIdentifier.mockResolvedValue({
        id: 'file_1',
        userId: 'user_123',
        datasets: [{ datasetId: 'ds_1' }, { datasetId: 'ds_2' }],
      })

      await handler(makeReq('file_1'), mockSession)

      expect(ok).toHaveBeenCalledWith({ id: 'file_1' })
    })

    it('should send an importFile event for each associated dataset', async () => {
      prisma.file.findUniqueByIdentifier.mockResolvedValue({
        id: 'file_1',
        userId: 'user_123',
        datasets: [{ datasetId: 'ds_1' }, { datasetId: 'ds_2' }],
      })

      await handler(makeReq('file_1'), mockSession)

      expect(sendEvent).toHaveBeenCalledTimes(2)
      expect(sendEvent).toHaveBeenCalledWith('ds_1', {
        type: 'importFile',
        payload: { fileId: 'file_1' },
      })
      expect(sendEvent).toHaveBeenCalledWith('ds_2', {
        type: 'importFile',
        payload: { fileId: 'file_1' },
      })
    })

    it('should succeed without sending any events when file has no datasets', async () => {
      prisma.file.findUniqueByIdentifier.mockResolvedValue({
        id: 'file_1',
        userId: 'user_123',
        datasets: [],
      })

      await handler(makeReq('file_1'), mockSession)

      expect(sendEvent).not.toHaveBeenCalled()
      expect(ok).toHaveBeenCalledWith({ id: 'file_1' })
    })

    it('should look up the file using the session user and requested fileId', async () => {
      prisma.file.findUniqueByIdentifier.mockResolvedValue({
        id: 'file_1',
        userId: 'user_123',
        datasets: [],
      })

      await handler(makeReq('file_1'), mockSession)

      expect(prisma.file.findUniqueByIdentifier).toHaveBeenCalledWith(
        mockSession.user,
        'file_1',
        expect.objectContaining({
          include: expect.objectContaining({ datasets: expect.anything() }),
        })
      )
    })
  })

  describe('authorization', () => {
    it('should return 404 when the file does not exist', async () => {
      prisma.file.findUniqueByIdentifier.mockResolvedValue(null)

      await handler(makeReq('missing_file'), mockSession)

      expect(notFound).toHaveBeenCalled()
      expect(sendEvent).not.toHaveBeenCalled()
    })

    it('should return 401 when the file belongs to another user', async () => {
      prisma.file.findUniqueByIdentifier.mockResolvedValue({
        id: 'file_1',
        userId: 'other_user',
        datasets: [{ datasetId: 'ds_1' }],
      })

      await handler(makeReq('file_1'), mockSession)

      expect(notAuthorized).toHaveBeenCalled()
      expect(sendEvent).not.toHaveBeenCalled()
    })
  })

  describe('dataset event fanout', () => {
    it('should send events concurrently for all datasets via Promise.all', async () => {
      const datasetIds = ['ds_1', 'ds_2', 'ds_3']

      prisma.file.findUniqueByIdentifier.mockResolvedValue({
        id: 'file_abc',
        userId: 'user_123',
        datasets: datasetIds.map((id) => ({ datasetId: id })),
      })

      const callOrder = []

      sendEvent.mockImplementation(async (dsId) => {
        callOrder.push(dsId)
      })

      await handler(makeReq('file_abc'), mockSession)

      expect(sendEvent).toHaveBeenCalledTimes(3)
      expect(callOrder).toEqual(expect.arrayContaining(datasetIds))
    })

    it('should include the correct fileId payload for each dataset event', async () => {
      prisma.file.findUniqueByIdentifier.mockResolvedValue({
        id: 'file_xyz',
        userId: 'user_123',
        datasets: [{ datasetId: 'ds_1' }],
      })

      await handler(makeReq('file_xyz'), mockSession)

      expect(sendEvent).toHaveBeenCalledWith(
        'ds_1',
        expect.objectContaining({
          payload: expect.objectContaining({ fileId: 'file_xyz' }),
        })
      )
    })
  })
})

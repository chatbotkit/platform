/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './create'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    dataset: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/store.types', () => ({
  getStore: jest.fn(),
}))

jest.mock('@/prisma/types', () => ({
  DatasetVisibility: {
    public: 'public',
    private: 'private',
    protected: 'protected',
  },
}))

jest.mock('@/lib/method', () => ({
  withPost: (fn) => fn,
}))

jest.mock('@/lib/session.handler', () => ({
  withSession: (fn) => fn,
}))

jest.mock('@/lib/limit.handler', () => ({
  withLimits: (_limits, fn) => fn,
}))

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: {
    object: jest.fn().mockReturnThis(),
    string: jest.fn().mockReturnThis(),
    number: jest.fn().mockReturnThis(),
    min: jest.fn().mockReturnThis(),
    allow: jest.fn().mockReturnThis(),
    valid: jest.fn().mockReturnThis(),
    spread: jest.fn().mockReturnThis(),
  },
  withSchema: (_schema, fn) => fn,
}))

jest.mock('@/lib/response', () => ({
  ok: (data) => ({ status: 200, body: data }),
}))

jest.mock('@/schemas/alias', () => ({}))
jest.mock('@/schemas/name', () => ({}))
jest.mock('@/schemas/description', () => ({}))
jest.mock('@/schemas/blueprintId', () => jest.fn(() => ({})))
jest.mock('@/schemas/notUsed', () => ({}))
jest.mock('@/schemas/reranker', () => jest.fn(() => ({})))
jest.mock('@/schemas/meta', () => ({}))

const { getStore } = require('@/lib/store.types')

describe('/api/v1/dataset/create', () => {
  const mockSession = {
    user: {
      id: 'user_123',
    },
  }

  const mockCreateDataset = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()

    prisma.dataset.create.mockResolvedValue({ id: 'dts_new_1' })

    getStore.mockResolvedValue({ createDataset: mockCreateDataset })
    mockCreateDataset.mockResolvedValue(undefined)
  })

  describe('basic creation', () => {
    it('should create a dataset and return its id', async () => {
      const req = {}
      const body = { name: 'My Dataset', description: 'Test dataset' }

      const result = await handler(req, mockSession, body)

      expect(result.status).toBe(200)
      expect(result.body).toEqual({ id: 'dts_new_1' })
    })

    it('should call prisma.dataset.create with userId and body fields', async () => {
      const req = {}
      const body = {
        name: 'My Dataset',
        description: 'A description',
        visibility: 'private',
      }

      await handler(req, mockSession, body)

      expect(prisma.dataset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user_123',
            name: 'My Dataset',
            description: 'A description',
            visibility: 'private',
          }),
        })
      )
    })

    it('should not persist a store field', async () => {
      const req = {}
      const body = { name: 'Dataset' }

      await handler(req, mockSession, body)

      const { data } = prisma.dataset.create.mock.calls[0][0]

      expect(data.store).toBeUndefined()
    })

    it('should not assign a reranker when none is provided', async () => {
      const req = {}
      const body = { name: 'Dataset without reranker' }

      await handler(req, mockSession, body)

      const { data } = prisma.dataset.create.mock.calls[0][0]

      // @note no reranker is assigned by default (opt-in) - stored falsy (null)
      expect(data.reranker).toBeFalsy()
    })

    it('should only select id from the created dataset', async () => {
      const req = {}
      const body = { name: 'Dataset' }

      await handler(req, mockSession, body)

      expect(prisma.dataset.create).toHaveBeenCalledWith(
        expect.objectContaining({ select: { id: true } })
      )
    })
  })

  describe('blueprint linking', () => {
    it('should extract id when blueprint is passed as an object', async () => {
      const req = {}
      const body = {
        name: 'Dataset',
        blueprintId: { id: 'bp_xyz', name: 'MyBlueprint' },
      }

      await handler(req, mockSession, body)

      expect(prisma.dataset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ blueprintId: 'bp_xyz' }),
        })
      )
    })

    it('should use the string directly when blueprint is a plain id', async () => {
      const req = {}
      const body = { name: 'Dataset', blueprintId: 'bp_abc' }

      await handler(req, mockSession, body)

      expect(prisma.dataset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ blueprintId: 'bp_abc' }),
        })
      )
    })

    it('should pass undefined blueprintId when not provided', async () => {
      const req = {}
      const body = { name: 'Dataset' }

      await handler(req, mockSession, body)

      const createCall = prisma.dataset.create.mock.calls[0][0]

      expect(createCall.data.blueprintId).toBeUndefined()
    })
  })

  describe('vector store initialization', () => {
    it('should call getStore without arguments', async () => {
      const req = {}
      const body = { name: 'Dataset' }

      await handler(req, mockSession, body)

      expect(getStore).toHaveBeenCalledWith()
    })

    it('should call createDataset on the store class with the new dataset id', async () => {
      prisma.dataset.create.mockResolvedValue({ id: 'dts_created_456' })

      const req = {}
      const body = { name: 'Dataset' }

      await handler(req, mockSession, body)

      expect(mockCreateDataset).toHaveBeenCalledWith({
        datasetId: 'dts_created_456',
      })
    })

    it('should propagate error if createDataset fails', async () => {
      getStore.mockResolvedValue({
        createDataset: jest
          .fn()
          .mockRejectedValue(new Error('Vector DB init failed')),
      })

      const req = {}
      const body = { name: 'Dataset' }

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'Vector DB init failed'
      )
    })
  })

  describe('error handling', () => {
    it('should propagate error when prisma.dataset.create fails', async () => {
      const dbError = new Error('Database error')

      prisma.dataset.create.mockRejectedValue(dbError)

      const req = {}
      const body = { name: 'Dataset' }

      await expect(handler(req, mockSession, body)).rejects.toThrow(
        'Database error'
      )

      expect(mockCreateDataset).not.toHaveBeenCalled()
    })
  })
})

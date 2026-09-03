/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import prisma from '@/prisma/client'

import handler from './update'

jest.mock(
  '@/prisma/client',
  () => ({
    __esModule: true,
    default: {
      dataset: {
        findUniqueByIdentifier: jest.fn(),
        update: jest.fn(),
      },
    },
  }),
  { virtual: true }
)

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
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

jest.mock('@/lib/joi.handler', () => ({
  __esModule: true,
  default: {
    object: jest.fn().mockReturnThis(),
    string: jest.fn().mockReturnThis(),
    number: jest.fn().mockReturnThis(),
    min: jest.fn().mockReturnThis(),
    allow: jest.fn().mockReturnThis(),
    valid: jest.fn().mockReturnThis(),
  },
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

jest.mock('@/lib/meta', () => ({
  getMeta: jest.fn((newMeta, existingMeta) => ({
    ...existingMeta,
    ...newMeta,
  })),
}))

jest.mock('@/schemas/alias', () => ({}))
jest.mock('@/schemas/name', () => ({}))
jest.mock('@/schemas/description', () => ({}))
jest.mock('@/schemas/blueprintId', () => jest.fn(() => ({})))
jest.mock('@/schemas/notUsed', () => ({}))
jest.mock('@/schemas/reranker', () => jest.fn(() => ({})))
jest.mock('@/schemas/meta', () => ({}))

const { getMeta } = require('@/lib/meta')

describe('POST /api/v1/dataset/[datasetId]/update', () => {
  const session = { user: { id: 'user-1' } }
  const req = { query: { datasetId: 'ds-1' } }

  const existingDataset = {
    id: 'ds-1',
    userId: 'user-1',
    meta: { existing: 'value' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getMeta.mockImplementation((newMeta, existingMeta) => ({
      ...existingMeta,
      ...newMeta,
    }))
  })

  describe('authorization', () => {
    it('returns 404 when dataset does not exist', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(null)

      const result = await handler(req, session, {})

      expect(result).toEqual({ status: 404 })
      expect(prisma.dataset.update).not.toHaveBeenCalled()
    })

    it('returns 401 when dataset is owned by another user', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...existingDataset,
        userId: 'user-2',
      })

      const result = await handler(req, session, {})

      expect(result).toEqual({ status: 401 })
      expect(prisma.dataset.update).not.toHaveBeenCalled()
    })

    it('proceeds when dataset belongs to the requesting user', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(existingDataset)
      prisma.dataset.update.mockResolvedValue({})

      const result = await handler(req, session, { name: 'New Name' })

      expect(result).toEqual({ status: 200, body: { id: 'ds-1' } })
      expect(prisma.dataset.update).toHaveBeenCalledTimes(1)
    })
  })

  describe('field updates', () => {
    it('updates basic name and description fields', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(existingDataset)
      prisma.dataset.update.mockResolvedValue({})

      const body = { name: 'Updated Name', description: 'Updated description' }

      await handler(req, session, body)

      expect(prisma.dataset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ds-1' },
          data: expect.objectContaining({
            name: 'Updated Name',
            description: 'Updated description',
          }),
        })
      )
    })

    it('updates search configuration fields', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(existingDataset)
      prisma.dataset.update.mockResolvedValue({})

      const body = {
        recordMaxTokens: 1500,
        searchMinScore: 0.75,
        searchMaxRecords: 8,
        searchMaxTokens: 4000,
      }

      await handler(req, session, body)

      expect(prisma.dataset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            recordMaxTokens: 1500,
            searchMinScore: 0.75,
            searchMaxRecords: 8,
            searchMaxTokens: 4000,
          }),
        })
      )
    })

    it('updates instructions', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(existingDataset)
      prisma.dataset.update.mockResolvedValue({})

      const body = {
        matchInstruction: 'Answer using these records',
        mismatchInstruction: 'No relevant records found',
      }

      await handler(req, session, body)

      expect(prisma.dataset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            matchInstruction: 'Answer using these records',
            mismatchInstruction: 'No relevant records found',
          }),
        })
      )
    })

    it('updates visibility', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(existingDataset)
      prisma.dataset.update.mockResolvedValue({})

      await handler(req, session, { visibility: 'public' })

      expect(prisma.dataset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ visibility: 'public' }),
        })
      )
    })

    it('uses blueprintId string from blueprint object when blueprint has id property', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(existingDataset)
      prisma.dataset.update.mockResolvedValue({})

      await handler(req, session, { blueprintId: { id: 'bp-123' } })

      expect(prisma.dataset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ blueprintId: 'bp-123' }),
        })
      )
    })

    it('uses blueprintId string directly when blueprint is a string', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(existingDataset)
      prisma.dataset.update.mockResolvedValue({})

      await handler(req, session, { blueprintId: 'bp-456' })

      expect(prisma.dataset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ blueprintId: 'bp-456' }),
        })
      )
    })
  })

  describe('meta merging', () => {
    it('merges new meta with existing meta via getMeta', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(existingDataset)
      prisma.dataset.update.mockResolvedValue({})

      const newMeta = { newKey: 'newValue' }

      await handler(req, session, { meta: newMeta })

      expect(getMeta).toHaveBeenCalledWith(newMeta, existingDataset.meta)
      expect(prisma.dataset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            meta: { existing: 'value', newKey: 'newValue' },
          }),
        })
      )
    })
  })

  describe('response', () => {
    it('returns the dataset id on success', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(existingDataset)
      prisma.dataset.update.mockResolvedValue({})

      const result = await handler(req, session, { name: 'New Name' })

      expect(result).toEqual({ status: 200, body: { id: 'ds-1' } })
    })

    it('looks up the dataset using the URL param', async () => {
      const reqWithId = { query: { datasetId: 'ds-xyz' } }

      prisma.dataset.findUniqueByIdentifier.mockResolvedValue({
        ...existingDataset,
        id: 'ds-xyz',
      })
      prisma.dataset.update.mockResolvedValue({})

      await handler(reqWithId, session, {})

      expect(prisma.dataset.findUniqueByIdentifier).toHaveBeenCalledWith(
        session.user,
        'ds-xyz'
      )
    })
  })

  describe('error handling', () => {
    it('propagates database error from findUniqueByIdentifier', async () => {
      prisma.dataset.findUniqueByIdentifier.mockRejectedValue(
        new Error('DB connection failed')
      )

      await expect(handler(req, session, {})).rejects.toThrow(
        'DB connection failed'
      )
    })

    it('propagates database error from update', async () => {
      prisma.dataset.findUniqueByIdentifier.mockResolvedValue(existingDataset)
      prisma.dataset.update.mockRejectedValue(new Error('Update failed'))

      await expect(handler(req, session, { name: 'X' })).rejects.toThrow(
        'Update failed'
      )
    })
  })
})

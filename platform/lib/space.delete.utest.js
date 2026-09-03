/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'
import { join } from '@/prisma/utils'

import { deleteManySpaces, deleteSpace } from './space.delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    space: {
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
    conversation: {
      updateMany: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/utils', () => ({
  join: jest.fn((arr) => arr.join(',')),
}))

describe('space.delete', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('deleteSpace', () => {
    it('should update conversations and delete space in transaction', async () => {
      const space = { id: 'space-123' }

      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        space: {
          delete: jest.fn().mockResolvedValue(space),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx)
      })

      await deleteSpace(space)

      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(mockTx.conversation.updateMany).toHaveBeenCalled()
      expect(mockTx.space.delete).toHaveBeenCalledWith({
        where: { id: 'space-123' },
      })
    })

    it('should handle transaction errors', async () => {
      const space = { id: 'space-456' }

      prisma.$transaction.mockRejectedValue(new Error('Transaction failed'))

      await expect(deleteSpace(space)).rejects.toThrow('Transaction failed')
    })

    it('should handle null spaceId in conversation updates', async () => {
      const space = { id: 'space-789' }

      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        space: {
          delete: jest.fn().mockResolvedValue(space),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx)
      })

      await deleteSpace(space)

      expect(mockTx.conversation.updateMany).toHaveBeenCalled()
      expect(mockTx.space.delete).toHaveBeenCalledWith({
        where: { id: 'space-789' },
      })
    })

    it('should delete space even if no conversations are updated', async () => {
      const space = { id: 'space-no-convs' }

      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        space: {
          delete: jest.fn().mockResolvedValue(space),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx)
      })

      await deleteSpace(space)

      expect(mockTx.space.delete).toHaveBeenCalledWith({
        where: { id: 'space-no-convs' },
      })
    })
  })

  describe('deleteManySpaces', () => {
    it('should delete multiple spaces in a single transaction', async () => {
      const spaces = [{ id: 'space-1' }, { id: 'space-2' }, { id: 'space-3' }]

      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockResolvedValue({ count: 5 }),
        },
        space: {
          deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx)
      })

      await deleteManySpaces(spaces)

      expect(mockTx.conversation.updateMany).toHaveBeenCalledWith({
        where: { spaceId: { in: ['space-1', 'space-2', 'space-3'] } },
        data: { spaceId: null },
      })
      expect(mockTx.space.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['space-1', 'space-2', 'space-3'] } },
      })
    })

    it('should return early without querying database when spaces array is empty', async () => {
      const spaces = []

      await deleteManySpaces(spaces)

      expect(join).not.toHaveBeenCalled()
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('should handle single space', async () => {
      const spaces = [{ id: 'space-single' }]

      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        space: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx)
      })

      await deleteManySpaces(spaces)

      expect(mockTx.conversation.updateMany).toHaveBeenCalledWith({
        where: { spaceId: { in: ['space-single'] } },
        data: { spaceId: null },
      })
      expect(mockTx.space.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['space-single'] } },
      })
    })

    it('should handle transaction errors', async () => {
      const spaces = [{ id: 'space-1' }, { id: 'space-2' }]

      prisma.$transaction.mockRejectedValue(
        new Error('Bulk delete transaction failed')
      )

      await expect(deleteManySpaces(spaces)).rejects.toThrow(
        'Bulk delete transaction failed'
      )
    })

    it('should update all conversations referencing any of the spaces', async () => {
      const spaces = [{ id: 'space-a' }, { id: 'space-b' }]

      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockResolvedValue({ count: 10 }),
        },
        space: {
          deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx)
      })

      await deleteManySpaces(spaces)

      expect(mockTx.conversation.updateMany).toHaveBeenCalledBefore(
        mockTx.space.deleteMany
      )
    })
  })
})

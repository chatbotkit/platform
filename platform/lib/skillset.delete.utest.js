/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { deleteManySkillsets, deleteSkillset } from './skillset.delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    conversation: {
      updateMany: jest.fn(),
    },
    skillset: {
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

jest.mock('@/prisma/utils', () => ({
  join: jest.fn((ids) => ids.join(', ')),
}))

describe('skillset.delete', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('deleteSkillset', () => {
    it('should delete a single skillset and update related conversations', async () => {
      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        skillset: {
          delete: jest.fn().mockResolvedValue({ id: 'skillset-123' }),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockTx)
      })

      const skillset = { id: 'skillset-123' }

      await deleteSkillset(skillset)

      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(mockTx.conversation.updateMany).toHaveBeenCalledTimes(1)
      expect(mockTx.skillset.delete).toHaveBeenCalledWith({
        where: { id: 'skillset-123' },
      })
    })

    it('should handle transaction rollback on error', async () => {
      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        skillset: {
          delete: jest
            .fn()
            .mockRejectedValue(new Error('Database deletion failed')),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockTx)
      })

      const skillset = { id: 'skillset-123' }

      await expect(deleteSkillset(skillset)).rejects.toThrow(
        'Database deletion failed'
      )

      expect(mockTx.conversation.updateMany).toHaveBeenCalled()
      expect(mockTx.skillset.delete).toHaveBeenCalled()
    })

    it('should execute conversation update before skillset deletion', async () => {
      const executionOrder = []
      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockImplementation(() => {
            executionOrder.push('updateMany')

            return Promise.resolve({ count: 0 })
          }),
        },
        skillset: {
          delete: jest.fn().mockImplementation(() => {
            executionOrder.push('delete')

            return Promise.resolve({ id: 'skillset-123' })
          }),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockTx)
      })

      const skillset = { id: 'skillset-123' }

      await deleteSkillset(skillset)

      expect(executionOrder).toEqual(['updateMany', 'delete'])
    })

    it('should handle skillsets with special characters in ID', async () => {
      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        skillset: {
          delete: jest.fn().mockResolvedValue({ id: 'skillset-with-dash' }),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockTx)
      })

      const skillset = { id: 'skillset-with-dash' }

      await deleteSkillset(skillset)

      expect(mockTx.skillset.delete).toHaveBeenCalledWith({
        where: { id: 'skillset-with-dash' },
      })
    })
  })

  describe('deleteManySkillsets', () => {
    it('should delete multiple skillsets and update related conversations', async () => {
      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        skillset: {
          deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockTx)
      })

      const skillsets = [
        { id: 'skillset-1' },
        { id: 'skillset-2' },
        { id: 'skillset-3' },
      ]

      await deleteManySkillsets(skillsets)

      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(mockTx.conversation.updateMany).toHaveBeenCalledTimes(1)
      expect(mockTx.skillset.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['skillset-1', 'skillset-2', 'skillset-3'] } },
      })
    })

    it('should return early without querying database when skillsets array is empty', async () => {
      const skillsets = []

      await deleteManySkillsets(skillsets)

      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('should handle single skillset in array', async () => {
      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        skillset: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockTx)
      })

      const skillsets = [{ id: 'skillset-1' }]

      await deleteManySkillsets(skillsets)

      expect(mockTx.skillset.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['skillset-1'] } },
      })
    })

    it('should handle transaction rollback on error', async () => {
      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        skillset: {
          deleteMany: jest
            .fn()
            .mockRejectedValue(new Error('Batch deletion failed')),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockTx)
      })

      const skillsets = [{ id: 'skillset-1' }, { id: 'skillset-2' }]

      await expect(deleteManySkillsets(skillsets)).rejects.toThrow(
        'Batch deletion failed'
      )

      expect(mockTx.conversation.updateMany).toHaveBeenCalled()
      expect(mockTx.skillset.deleteMany).toHaveBeenCalled()
    })

    it('should execute conversation update before skillsets deletion', async () => {
      const executionOrder = []
      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockImplementation(() => {
            executionOrder.push('updateMany')

            return Promise.resolve({ count: 0 })
          }),
        },
        skillset: {
          deleteMany: jest.fn().mockImplementation(() => {
            executionOrder.push('deleteMany')

            return Promise.resolve({ count: 2 })
          }),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockTx)
      })

      const skillsets = [{ id: 'skillset-1' }, { id: 'skillset-2' }]

      await deleteManySkillsets(skillsets)

      expect(executionOrder).toEqual(['updateMany', 'deleteMany'])
    })

    it('should handle skillsets with various ID formats', async () => {
      const mockTx = {
        conversation: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        skillset: {
          deleteMany: jest.fn().mockResolvedValue({ count: 4 }),
        },
      }

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(mockTx)
      })

      const skillsets = [
        { id: 'abc123' },
        { id: 'skill-set-1' },
        { id: '12345' },
        { id: 'UPPERCASE' },
      ]

      await deleteManySkillsets(skillsets)

      expect(mockTx.skillset.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['abc123', 'skill-set-1', '12345', 'UPPERCASE'] },
        },
      })
    })
  })
})

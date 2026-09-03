/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { deleteBot, deleteManyBots } from './bot.delete'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/prisma/utils', () => ({
  join: jest.fn((ids) => ids.join(',')),
}))

describe('bot deletion', () => {
  let mockTx

  beforeEach(() => {
    mockReset(prisma)

    mockTx = {
      conversation: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      bot: {
        delete: jest.fn().mockResolvedValue({ id: 'bot-1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    }

    prisma.$transaction = jest.fn().mockImplementation((cb) => cb(mockTx))
  })

  // ---------------------------------------------------------------------------
  // deleteBot
  // ---------------------------------------------------------------------------

  describe('deleteBot', () => {
    it('should clear botId from all conversations referencing the bot', async () => {
      await deleteBot({ id: 'bot-123' })

      expect(mockTx.conversation.updateMany).toHaveBeenCalled()
    })

    it('should delete the bot itself', async () => {
      await deleteBot({ id: 'bot-123' })

      expect(mockTx.bot.delete).toHaveBeenCalledWith({
        where: { id: 'bot-123' },
      })
    })

    it('should execute both operations in a transaction', async () => {
      await deleteBot({ id: 'bot-456' })

      expect(prisma.$transaction).toHaveBeenCalled()
      expect(mockTx.conversation.updateMany).toHaveBeenCalled()
      expect(mockTx.bot.delete).toHaveBeenCalled()
    })

    it('should throw when transaction fails', async () => {
      const error = new Error('Transaction failed')

      prisma.$transaction = jest.fn().mockRejectedValue(error)

      await expect(deleteBot({ id: 'bot-123' })).rejects.toThrow(
        'Transaction failed'
      )
    })

    it('should use the correct bot ID in the delete call', async () => {
      await deleteBot({ id: 'bot-unique-id' })

      expect(mockTx.bot.delete).toHaveBeenCalledWith({
        where: { id: 'bot-unique-id' },
      })
    })

    it('should handle bot deletion failure in transaction', async () => {
      mockTx.bot.delete.mockRejectedValue(new Error('Delete failed'))
      prisma.$transaction = jest
        .fn()
        .mockImplementation((cb) => cb(mockTx).catch((e) => Promise.reject(e)))

      await expect(deleteBot({ id: 'bot-123' })).rejects.toThrow(
        'Delete failed'
      )
    })

    it('should handle conversation update failure in transaction', async () => {
      mockTx.conversation.updateMany.mockRejectedValue(new Error('Update failed'))
      prisma.$transaction = jest
        .fn()
        .mockImplementation((cb) => cb(mockTx).catch((e) => Promise.reject(e)))

      await expect(deleteBot({ id: 'bot-123' })).rejects.toThrow(
        'Update failed'
      )
    })
  })

  // ---------------------------------------------------------------------------
  // deleteManyBots
  // ---------------------------------------------------------------------------

  describe('deleteManyBots', () => {
    it('should return early without transaction when bots array is empty', async () => {
      await deleteManyBots([])

      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('should clear botId from conversations for multiple bots', async () => {
      await deleteManyBots([{ id: 'bot-1' }, { id: 'bot-2' }])

      expect(mockTx.conversation.updateMany).toHaveBeenCalled()
    })

    it('should delete all bots in a single deleteMany call', async () => {
      const bots = [{ id: 'bot-1' }, { id: 'bot-2' }, { id: 'bot-3' }]

      await deleteManyBots(bots)

      expect(mockTx.bot.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['bot-1', 'bot-2', 'bot-3'] } },
      })
    })

    it('should include all bot IDs in deletion', async () => {
      const bots = [{ id: 'bot-a' }, { id: 'bot-b' }]

      await deleteManyBots(bots)

      expect(mockTx.bot.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['bot-a', 'bot-b'] } },
      })
    })

    it('should execute both operations in a single transaction', async () => {
      await deleteManyBots([{ id: 'bot-1' }, { id: 'bot-2' }])

      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(mockTx.conversation.updateMany).toHaveBeenCalled()
      expect(mockTx.bot.deleteMany).toHaveBeenCalled()
    })

    it('should handle single bot in array', async () => {
      await deleteManyBots([{ id: 'bot-single' }])

      expect(mockTx.bot.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['bot-single'] } },
      })
    })

    it('should handle large number of bots', async () => {
      const bots = Array.from({ length: 100 }, (_, i) => ({
        id: `bot-${i}`,
      }))

      await deleteManyBots(bots)

      const call = mockTx.bot.deleteMany.mock.calls[0][0]

      expect(call.where.id.in).toHaveLength(100)
    })

    it('should throw when transaction fails', async () => {
      const error = new Error('Transaction failed')

      prisma.$transaction = jest.fn().mockRejectedValue(error)

      await expect(deleteManyBots([{ id: 'bot-1' }])).rejects.toThrow(
        'Transaction failed'
      )
    })

    it('should handle conversation update failure for multiple bots', async () => {
      mockTx.conversation.updateMany.mockRejectedValue(new Error('Batch update failed'))
      prisma.$transaction = jest
        .fn()
        .mockImplementation((cb) => cb(mockTx).catch((e) => Promise.reject(e)))

      await expect(
        deleteManyBots([{ id: 'bot-1' }, { id: 'bot-2' }])
      ).rejects.toThrow('Batch update failed')
    })

    it('should handle deleteMany failure', async () => {
      mockTx.bot.deleteMany.mockRejectedValue(new Error('Delete failed'))
      prisma.$transaction = jest
        .fn()
        .mockImplementation((cb) => cb(mockTx).catch((e) => Promise.reject(e)))

      await expect(
        deleteManyBots([{ id: 'bot-1' }, { id: 'bot-2' }])
      ).rejects.toThrow('Delete failed')
    })

    it('should preserve bot data in deleteMany call for atomic deletion', async () => {
      const bots = [{ id: 'bot-x' }, { id: 'bot-y' }, { id: 'bot-z' }]

      await deleteManyBots(bots)

      const deleteManyCall = mockTx.bot.deleteMany.mock.calls[0][0]

      expect(deleteManyCall.where.id.in.sort()).toEqual(
        ['bot-x', 'bot-y', 'bot-z'].sort()
      )
    })
  })

  // ---------------------------------------------------------------------------
  // Data integrity and atomicity
  // ---------------------------------------------------------------------------

  describe('data integrity', () => {
    it('should not delete bot before clearing conversation references', async () => {
      const callOrder = []

      mockTx.conversation.updateMany.mockImplementation(() => {
        callOrder.push('update')

        return Promise.resolve()
      })
      mockTx.bot.delete.mockImplementation(() => {
        callOrder.push('delete')

        return Promise.resolve()
      })

      await deleteBot({ id: 'bot-123' })

      expect(callOrder[0]).toBe('update')
      expect(callOrder[1]).toBe('delete')
    })

    it('should atomically update and delete bot in single transaction', async () => {
      let transactionCallCount = 0

      prisma.$transaction = jest.fn().mockImplementation((cb) => {
        transactionCallCount++

        return cb(mockTx)
      })

      await deleteBot({ id: 'bot-123' })

      expect(transactionCallCount).toBe(1)
    })

    it('should atomically delete multiple bots and their conversation references', async () => {
      let transactionCallCount = 0

      prisma.$transaction = jest.fn().mockImplementation((cb) => {
        transactionCallCount++

        return cb(mockTx)
      })

      await deleteManyBots([{ id: 'bot-1' }, { id: 'bot-2' }])

      expect(transactionCallCount).toBe(1)
    })

    it('should use transaction to ensure consistency', async () => {
      await deleteBot({ id: 'bot-123' })

      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle empty bot ID string', async () => {
      await deleteBot({ id: '' })

      expect(mockTx.bot.delete).toHaveBeenCalledWith({
        where: { id: '' },
      })
    })

    it('should handle special characters in bot ID', async () => {
      const specialId = 'bot-123-!@#$%'

      await deleteBot({ id: specialId })

      expect(mockTx.bot.delete).toHaveBeenCalledWith({
        where: { id: specialId },
      })
    })

    it('should handle very long bot ID', async () => {
      const longId = 'bot-' + 'x'.repeat(1000)

      await deleteBot({ id: longId })

      expect(mockTx.bot.delete).toHaveBeenCalledWith({
        where: { id: longId },
      })
    })

    it('should handle deleteManyBots with duplicate IDs', async () => {
      const bots = [{ id: 'bot-1' }, { id: 'bot-1' }, { id: 'bot-2' }]

      await deleteManyBots(bots)

      expect(mockTx.bot.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['bot-1', 'bot-1', 'bot-2'] } },
      })
    })

    it('should handle transaction callback errors', async () => {
      const error = new Error('Callback error')

      prisma.$transaction = jest.fn().mockImplementation((cb) => {
        throw error
      })

      await expect(deleteBot({ id: 'bot-123' })).rejects.toThrow(
        'Callback error'
      )
    })
  })
})

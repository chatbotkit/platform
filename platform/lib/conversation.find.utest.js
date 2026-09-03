/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { hasConversation } from '@/lib/conversation.find'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      findUnique: jest.fn(),
    },
  },
}))

describe('conversation.find', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('hasConversation', () => {
    it('should return true when conversation exists', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-123',
        userId: 'user-123',
        createdAt: new Date(),
      })

      const result = await hasConversation('conv-123')

      expect(result).toBe(true)
      expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'conv-123',
        },
      })
      expect(prisma.conversation.findUnique).toHaveBeenCalledTimes(1)
    })

    it('should return false when conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const result = await hasConversation('conv-nonexistent')

      expect(result).toBe(false)
      expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'conv-nonexistent',
        },
      })
    })

    it('should return false when conversation is undefined', async () => {
      prisma.conversation.findUnique.mockResolvedValue(undefined)

      const result = await hasConversation('conv-undefined')

      expect(result).toBe(false)
    })

    it('should handle empty string conversation ID', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null)

      const result = await hasConversation('')

      expect(result).toBe(false)
      expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
        where: {
          id: '',
        },
      })
    })

    it('should handle valid conversation with minimal fields', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-minimal',
      })

      const result = await hasConversation('conv-minimal')

      expect(result).toBe(true)
    })

    it('should handle database errors', async () => {
      prisma.conversation.findUnique.mockRejectedValue(
        new Error('Database connection error')
      )

      await expect(hasConversation('conv-error')).rejects.toThrow(
        'Database connection error'
      )
    })

    it('should handle prisma query timeout', async () => {
      prisma.conversation.findUnique.mockRejectedValue(
        new Error('Query timeout')
      )

      await expect(hasConversation('conv-timeout')).rejects.toThrow(
        'Query timeout'
      )
    })

    it('should call findUnique with correct structure', async () => {
      prisma.conversation.findUnique.mockResolvedValue({ id: 'test' })

      await hasConversation('test-id')

      const callArgs = prisma.conversation.findUnique.mock.calls[0][0]

      expect(callArgs).toHaveProperty('where')
      expect(callArgs.where).toHaveProperty('id')
      expect(callArgs.where.id).toBe('test-id')
    })
  })
})

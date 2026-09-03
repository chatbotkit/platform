/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import prisma from '@/prisma/client'

import { deleteConversation } from '@/lib/conversation.delete'
import { untrackIdlingConversations } from '@/lib/conversation.idle'
import { deleteObjects } from '@/lib/storage'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    conversation: {
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/lib/storage', () => ({
  deleteObjects: jest.fn(),
}))

jest.mock('@/lib/conversation.idle', () => ({
  untrackIdlingConversations: jest.fn(),
}))

jest.mock('@/lib/storage', () => ({
  deleteObjects: jest.fn(),
}))

jest.mock('@/lib/conversation.idle', () => ({
  untrackIdlingConversations: jest.fn(),
}))

describe('deleteConversation', () => {
  const mockConversationId = 'conv-test-123'
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('successful deletion', () => {
    it('should delete conversation from database', async () => {
      prisma.conversation.delete.mockResolvedValue({
        id: mockConversationId,
      })
      untrackIdlingConversations.mockResolvedValue(undefined)
      deleteObjects.mockResolvedValue(undefined)

      await deleteConversation(mockConversationId)

      expect(prisma.conversation.delete).toHaveBeenCalledWith({
        where: {
          id: mockConversationId,
        },
      })
    })

    it('should untrack idling conversations', async () => {
      prisma.conversation.delete.mockResolvedValue({
        id: mockConversationId,
      })
      untrackIdlingConversations.mockResolvedValue(undefined)
      deleteObjects.mockResolvedValue(undefined)

      await deleteConversation(mockConversationId)

      expect(untrackIdlingConversations).toHaveBeenCalledWith([
        mockConversationId,
      ])
    })

    it('should delete S3 objects for the conversation', async () => {
      prisma.conversation.delete.mockResolvedValue({
        id: mockConversationId,
      })
      untrackIdlingConversations.mockResolvedValue(undefined)
      deleteObjects.mockResolvedValue(undefined)

      await deleteConversation(mockConversationId)

      expect(deleteObjects).toHaveBeenCalledWith(
        expect.any(String),
        mockConversationId
      )
    })

    it('should execute all cleanup operations in correct order', async () => {
      const callOrder = []

      prisma.conversation.delete.mockImplementation(async () => {
        callOrder.push('database')

        return { id: mockConversationId }
      })

      untrackIdlingConversations.mockImplementation(async () => {
        callOrder.push('untrack')
      })

      deleteObjects.mockImplementation(async () => {
        callOrder.push('s3')
      })

      await deleteConversation(mockConversationId)

      expect(callOrder).toEqual(['database', 'untrack', 's3'])
    })

    it('should complete successfully without returning value', async () => {
      prisma.conversation.delete.mockResolvedValue({
        id: mockConversationId,
      })
      untrackIdlingConversations.mockResolvedValue(undefined)
      deleteObjects.mockResolvedValue(undefined)

      const result = await deleteConversation(mockConversationId)

      expect(result).toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('should propagate database deletion errors', async () => {
      const dbError = new Error('Database deletion failed')

      prisma.conversation.delete.mockRejectedValue(dbError)

      await expect(deleteConversation(mockConversationId)).rejects.toThrow(
        'Database deletion failed'
      )
    })

    it('should propagate idle tracking cleanup errors', async () => {
      prisma.conversation.delete.mockResolvedValue({
        id: mockConversationId,
      })

      const trackingError = new Error('Tracking cleanup failed')

      untrackIdlingConversations.mockRejectedValue(trackingError)

      await expect(deleteConversation(mockConversationId)).rejects.toThrow(
        'Tracking cleanup failed'
      )
    })

    it('should propagate S3 deletion errors', async () => {
      prisma.conversation.delete.mockResolvedValue({
        id: mockConversationId,
      })
      untrackIdlingConversations.mockResolvedValue(undefined)

      const s3Error = new Error('S3 deletion failed')

      deleteObjects.mockRejectedValue(s3Error)

      await expect(deleteConversation(mockConversationId)).rejects.toThrow(
        'S3 deletion failed'
      )
    })

    // @note this used to assert that the module failed to load when the
    // conversation bucket variable was unset. The platform no longer reads a
    // bucket name - it names the `conversation` store and the storage module
    // resolves it - so there is nothing here to misconfigure. The equivalent
    // check is `assertConfigured` in platform/tests/config/providers.utest.js.
  })

  describe('edge cases', () => {
    it('should handle empty conversation ID', async () => {
      prisma.conversation.delete.mockResolvedValue(null)
      untrackIdlingConversations.mockResolvedValue(undefined)
      deleteObjects.mockResolvedValue(undefined)

      await deleteConversation('')

      expect(prisma.conversation.delete).toHaveBeenCalledWith({
        where: { id: '' },
      })
    })

    it('should handle special characters in conversation ID', async () => {
      const specialId = 'conv-test@#$%123'

      prisma.conversation.delete.mockResolvedValue({ id: specialId })
      untrackIdlingConversations.mockResolvedValue(undefined)
      deleteObjects.mockResolvedValue(undefined)

      await deleteConversation(specialId)

      expect(prisma.conversation.delete).toHaveBeenCalledWith({
        where: { id: specialId },
      })
      expect(deleteObjects).toHaveBeenCalledWith(expect.any(String), specialId)
    })

    it('should handle very long conversation IDs', async () => {
      const longId = 'conv-' + 'a'.repeat(1000)

      prisma.conversation.delete.mockResolvedValue({ id: longId })
      untrackIdlingConversations.mockResolvedValue(undefined)
      deleteObjects.mockResolvedValue(undefined)

      await deleteConversation(longId)

      expect(prisma.conversation.delete).toHaveBeenCalledWith({
        where: { id: longId },
      })
    })
  })

  describe('environment configuration', () => {
    it('should use configured S3 bucket name from environment', async () => {
      // The bucket name is captured at module load time via Zod parsing
      // We verify that deleteObjects is called with the conversation ID
      // and that the bucket name comes from the environment
      prisma.conversation.delete.mockResolvedValue({
        id: mockConversationId,
      })
      untrackIdlingConversations.mockResolvedValue(undefined)
      deleteObjects.mockResolvedValue(undefined)

      await deleteConversation(mockConversationId)

      // Verify deleteObjects is called with a bucket name (string) and the conversation ID
      expect(deleteObjects).toHaveBeenCalledWith(
        expect.any(String),
        mockConversationId
      )

      // Verify the bucket name is not empty
      const [bucketName] = deleteObjects.mock.calls[0]

      expect(bucketName.length).toBeGreaterThan(0)
    })
  })
})

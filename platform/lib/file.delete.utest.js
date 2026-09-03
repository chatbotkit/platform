/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import { deleteFile } from '@/lib/file.delete'
import { deleteObjects } from '@/lib/storage'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    file: {
      delete: jest.fn(),
    },
  },
}))

jest.mock('@/lib/storage', () => ({
  deleteObjects: jest.fn(),
}))

describe('file.delete', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('deleteFile', () => {
    it('should delete file from S3 and database', async () => {
      deleteObjects.mockResolvedValue(undefined)

      const file = { id: 'test-file-id' }

      await deleteFile(file)

      // @note bucket name comes from env, use expect.any(String) since we cannot mock it

      expect(deleteObjects).toHaveBeenCalledWith(
        expect.any(String),
        'test-file-id'
      )

      expect(prisma.file.delete).toHaveBeenCalledWith({
        where: {
          id: 'test-file-id',
        },
      })
    })

    it('should handle file with different id', async () => {
      deleteObjects.mockResolvedValue(undefined)

      const file = { id: 'another-file-id' }

      await deleteFile(file)

      expect(deleteObjects).toHaveBeenCalledWith(
        expect.any(String),
        'another-file-id'
      )

      expect(prisma.file.delete).toHaveBeenCalledWith({
        where: {
          id: 'another-file-id',
        },
      })
    })

    it('should propagate errors from S3 API', async () => {
      const mockError = new Error('S3 API error')

      deleteObjects.mockRejectedValue(mockError)

      const file = { id: 'test-file-id' }

      await expect(deleteFile(file)).rejects.toThrow('S3 API error')

      // should not reach database deletion
      expect(prisma.file.delete).not.toHaveBeenCalled()
    })

    it('should propagate errors from database deletion', async () => {
      deleteObjects.mockResolvedValue(undefined)

      const mockError = new Error('Database error')

      prisma.file.delete.mockRejectedValue(mockError)

      const file = { id: 'test-file-id' }

      await expect(deleteFile(file)).rejects.toThrow('Database error')

      expect(deleteObjects).toHaveBeenCalled()
      expect(prisma.file.delete).toHaveBeenCalled()
    })

    it('should handle file with special characters in id', async () => {
      deleteObjects.mockResolvedValue(undefined)
      prisma.file.delete.mockResolvedValue(undefined)

      const file = { id: 'file-with-special-chars-!@#$' }

      await deleteFile(file)

      expect(deleteObjects).toHaveBeenCalledWith(
        expect.any(String),
        'file-with-special-chars-!@#$'
      )
    })
  })
})

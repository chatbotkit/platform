/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import { cleanupOldUsageRecords } from './usage.cleanup'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

jest.mock('@/lib/it', () => ({
  batchAsync: jest.fn(async function* (it, batchSize) {
    const items = []

    for await (const item of it) {
      items.push(item)
    }

    for (let i = 0; i < items.length; i += batchSize) {
      yield items.slice(i, i + batchSize)
    }
  }),
}))

describe('cleanupOldUsageRecords', () => {
  beforeEach(() => {
    mockReset(prisma)
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-06-15T00:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('basic functionality', () => {
    it('should delete records older than default 180 days', async () => {
      prisma.usage.count.mockResolvedValue(100)
      prisma.usage.paginate.mockReturnValue(
        (async function* () {
          yield { id: 'usage1' }
          yield { id: 'usage2' }
        })()
      )
      prisma.usage.deleteMany.mockResolvedValue({ count: 2 })

      await cleanupOldUsageRecords()

      expect(prisma.usage.count).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
        },
      })

      const countCall = prisma.usage.count.mock.calls[0][0]
      const cutoffDate = countCall.where.createdAt.lt
      const expectedCutoff = new Date('2024-06-15T00:00:00.000Z')

      expectedCutoff.setDate(expectedCutoff.getDate() - 180)

      expect(cutoffDate.getTime()).toBeCloseTo(expectedCutoff.getTime(), -3)
    })

    it('should use custom cutoffDays when provided', async () => {
      prisma.usage.count.mockResolvedValue(50)
      prisma.usage.paginate.mockReturnValue((async function* () {})())

      await cleanupOldUsageRecords({ cutoffDays: 90 })

      const countCall = prisma.usage.count.mock.calls[0][0]
      const cutoffDate = countCall.where.createdAt.lt
      const expectedCutoff = new Date('2024-06-15T00:00:00.000Z')

      expectedCutoff.setDate(expectedCutoff.getDate() - 90)

      expect(cutoffDate.getTime()).toBeCloseTo(expectedCutoff.getTime(), -3)
    })

    it('should return early when no records to delete', async () => {
      prisma.usage.count.mockResolvedValue(0)

      await cleanupOldUsageRecords()

      expect(prisma.usage.count).toHaveBeenCalledTimes(1)
      expect(prisma.usage.paginate).not.toHaveBeenCalled()
      expect(prisma.usage.deleteMany).not.toHaveBeenCalled()
    })

    it('should call deleteMany for each batch', async () => {
      prisma.usage.count.mockResolvedValue(3)
      prisma.usage.paginate.mockReturnValue(
        (async function* () {
          yield { id: 'usage1' }
          yield { id: 'usage2' }
          yield { id: 'usage3' }
        })()
      )
      prisma.usage.deleteMany.mockResolvedValue({ count: 2 })

      await cleanupOldUsageRecords()

      expect(prisma.usage.deleteMany).toHaveBeenCalled()
      expect(prisma.usage.deleteMany.mock.calls[0][0]).toEqual({
        where: {
          id: {
            in: expect.arrayContaining(['usage1', 'usage2']),
          },
        },
      })
    })
  })

  describe('progress tracking', () => {
    it('should call onProgress initially with zero deleted', async () => {
      const onProgress = jest.fn()

      prisma.usage.count.mockResolvedValue(100)
      prisma.usage.paginate.mockReturnValue((async function* () {})())

      await cleanupOldUsageRecords({ onProgress })

      expect(onProgress).toHaveBeenCalledWith({ deleted: 0, total: 100 })
    })

    it('should call onProgress after each batch', async () => {
      const onProgress = jest.fn()

      prisma.usage.count.mockResolvedValue(5)
      prisma.usage.paginate.mockReturnValue(
        (async function* () {
          yield { id: 'usage1' }
          yield { id: 'usage2' }
          yield { id: 'usage3' }
        })()
      )
      prisma.usage.deleteMany.mockResolvedValue({ count: 2 })

      await cleanupOldUsageRecords({ onProgress })

      expect(onProgress).toHaveBeenCalledTimes(2)
      expect(onProgress).toHaveBeenNthCalledWith(1, { deleted: 0, total: 5 })
      expect(onProgress).toHaveBeenNthCalledWith(2, { deleted: 3, total: 5 })
    })

    it('should not call onProgress when not provided', async () => {
      prisma.usage.count.mockResolvedValue(10)
      prisma.usage.paginate.mockReturnValue(
        (async function* () {
          yield { id: 'usage1' }
        })()
      )
      prisma.usage.deleteMany.mockResolvedValue({ count: 1 })

      await expect(cleanupOldUsageRecords()).resolves.toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('should throw when cutoff date is in the future', async () => {
      await expect(cleanupOldUsageRecords({ cutoffDays: -10 })).rejects.toThrow(
        'Cutoff date must be in the past'
      )

      expect(prisma.usage.count).not.toHaveBeenCalled()
    })

    it('should throw when cutoffDays would result in future date', async () => {
      await expect(cleanupOldUsageRecords({ cutoffDays: -1 })).rejects.toThrow(
        'Cutoff date must be in the past'
      )

      expect(prisma.usage.count).not.toHaveBeenCalled()
    })
  })

  describe('batch processing', () => {
    it('should handle large datasets with pagination', async () => {
      prisma.usage.count.mockResolvedValue(1500)

      const mockRecords = Array.from({ length: 1500 }, (_, i) => ({
        id: `usage${i + 1}`,
      }))

      prisma.usage.paginate.mockReturnValue(
        (async function* () {
          for (const record of mockRecords) {
            yield record
          }
        })()
      )

      prisma.usage.deleteMany.mockResolvedValue({ count: 500 })

      await cleanupOldUsageRecords()

      expect(prisma.usage.paginate).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
        },
        select: {
          id: true,
        },
        take: 1000,
      })
    })

    it('should preserve last record in batch for cursor validity', async () => {
      prisma.usage.count.mockResolvedValue(5)
      prisma.usage.paginate.mockReturnValue(
        (async function* () {
          yield { id: 'usage1' }
          yield { id: 'usage2' }
          yield { id: 'usage3' }
          yield { id: 'usage4' }
          yield { id: 'usage5' }
        })()
      )
      prisma.usage.deleteMany.mockResolvedValue({ count: 4 })

      await cleanupOldUsageRecords()

      const deleteCall = prisma.usage.deleteMany.mock.calls[0][0]
      const deletedIds = deleteCall.where.id.in

      expect(deletedIds).toHaveLength(4)
      expect(deletedIds).not.toContain('usage5')
    })
  })

  describe('edge cases', () => {
    it('should handle empty options object', async () => {
      prisma.usage.count.mockResolvedValue(0)

      await cleanupOldUsageRecords({})

      expect(prisma.usage.count).toHaveBeenCalled()
    })

    it('should handle single record to delete', async () => {
      prisma.usage.count.mockResolvedValue(1)
      prisma.usage.paginate.mockReturnValue(
        (async function* () {
          yield { id: 'usage1' }
        })()
      )
      prisma.usage.deleteMany.mockResolvedValue({ count: 0 })

      await cleanupOldUsageRecords()

      expect(prisma.usage.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: [],
          },
        },
      })
    })

    it('should handle very large cutoffDays', async () => {
      prisma.usage.count.mockResolvedValue(0)

      await cleanupOldUsageRecords({ cutoffDays: 3650 })

      const countCall = prisma.usage.count.mock.calls[0][0]
      const cutoffDate = countCall.where.createdAt.lt

      expect(cutoffDate).toBeInstanceOf(Date)
      expect(cutoffDate.getTime()).toBeLessThan(Date.now())
    })
  })
})

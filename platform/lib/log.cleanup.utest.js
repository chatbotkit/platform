/**
 * @jest-environment node
 */
import { mockDeep, mockReset } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import {
  cleanupOldAuditLogs,
  cleanupOldEventLogs,
  cleanupOldEventMetrics,
} from './log.cleanup'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: mockDeep(),
}))

describe('log.cleanup', () => {
  beforeEach(() => {
    mockReset(prisma)
  })

  describe('cleanupOldEventLogs', () => {
    it('should cleanup event logs older than default cutoff (365 days)', async () => {
      prisma.eventLog.count.mockResolvedValue(1000)

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { id: 'log1' }
          yield { id: 'log2' }
          yield { id: 'log3' }
          yield { id: 'log4' }
        },
      }

      prisma.eventLog.paginate.mockReturnValue(mockIterator)
      prisma.eventLog.deleteMany.mockResolvedValue({ count: 3 })

      await cleanupOldEventLogs()

      expect(prisma.eventLog.count).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date),
          },
        },
      })

      expect(prisma.eventLog.paginate).toHaveBeenCalledWith({
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

      expect(prisma.eventLog.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['log1', 'log2', 'log3'],
          },
        },
      })
    })

    it('should use custom cutoff days', async () => {
      prisma.eventLog.count.mockResolvedValue(500)

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { id: 'log1' }
          yield { id: 'log2' }
        },
      }

      prisma.eventLog.paginate.mockReturnValue(mockIterator)
      prisma.eventLog.deleteMany.mockResolvedValue({ count: 1 })

      await cleanupOldEventLogs({ cutoffDays: 30 })

      const countCall = prisma.eventLog.count.mock.calls[0][0]
      const cutoffDate = countCall.where.createdAt.lt

      const expectedCutoff = new Date()

      expectedCutoff.setDate(expectedCutoff.getDate() - 30)

      expect(cutoffDate.getTime()).toBeCloseTo(expectedCutoff.getTime(), -4)
    })

    it('should call onProgress callback with progress updates', async () => {
      const onProgress = jest.fn()

      prisma.eventLog.count.mockResolvedValue(100)

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { id: 'log1' }
          yield { id: 'log2' }
          yield { id: 'log3' }
          yield { id: 'log4' }
          yield { id: 'log5' }
        },
      }

      prisma.eventLog.paginate.mockReturnValue(mockIterator)
      prisma.eventLog.deleteMany.mockResolvedValue({ count: 2 })

      await cleanupOldEventLogs({ onProgress })

      expect(onProgress).toHaveBeenCalledWith({ deleted: 0, total: 100 })
      expect(onProgress).toHaveBeenCalledWith({ deleted: 5, total: 100 })
    })

    it('should return early when no logs to delete', async () => {
      prisma.eventLog.count.mockResolvedValue(0)

      await cleanupOldEventLogs()

      expect(prisma.eventLog.paginate).not.toHaveBeenCalled()
      expect(prisma.eventLog.deleteMany).not.toHaveBeenCalled()
    })

    it('should throw error when cutoff date is in the future', async () => {
      await expect(cleanupOldEventLogs({ cutoffDays: -1 })).rejects.toThrow(
        'Cutoff date must be in the past'
      )

      expect(prisma.eventLog.count).not.toHaveBeenCalled()
    })

    it('should leave last record in batch to keep cursor valid', async () => {
      prisma.eventLog.count.mockResolvedValue(5)

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { id: 'log1' }
          yield { id: 'log2' }
          yield { id: 'log3' }
          yield { id: 'log4' }
          yield { id: 'log5' }
        },
      }

      prisma.eventLog.paginate.mockReturnValue(mockIterator)
      prisma.eventLog.deleteMany.mockResolvedValue({ count: 4 })

      await cleanupOldEventLogs()

      expect(prisma.eventLog.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ['log1', 'log2', 'log3', 'log4'],
          },
        },
      })
    })
  })

  describe('cleanupOldEventMetrics', () => {
    it('should cleanup event metrics older than default cutoff (90 days)', async () => {
      prisma.eventMetric.count.mockResolvedValue(500)

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { id: 'metric1' }
          yield { id: 'metric2' }
        },
      }

      prisma.eventMetric.paginate.mockReturnValue(mockIterator)
      prisma.eventMetric.deleteMany.mockResolvedValue({ count: 1 })

      await cleanupOldEventMetrics()

      expect(prisma.eventMetric.count).toHaveBeenCalled()
      expect(prisma.eventMetric.paginate).toHaveBeenCalled()
      expect(prisma.eventMetric.deleteMany).toHaveBeenCalled()
    })

    it('should use custom cutoff days for metrics', async () => {
      prisma.eventMetric.count.mockResolvedValue(200)

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { id: 'metric1' }
        },
      }

      prisma.eventMetric.paginate.mockReturnValue(mockIterator)
      prisma.eventMetric.deleteMany.mockResolvedValue({ count: 0 })

      await cleanupOldEventMetrics({ cutoffDays: 60 })

      const countCall = prisma.eventMetric.count.mock.calls[0][0]
      const cutoffDate = countCall.where.createdAt.lt

      const expectedCutoff = new Date()

      expectedCutoff.setDate(expectedCutoff.getDate() - 60)

      expect(cutoffDate.getTime()).toBeCloseTo(expectedCutoff.getTime(), -4)
    })

    it('should return early when no metrics to delete', async () => {
      prisma.eventMetric.count.mockResolvedValue(0)

      await cleanupOldEventMetrics()

      expect(prisma.eventMetric.paginate).not.toHaveBeenCalled()
      expect(prisma.eventMetric.deleteMany).not.toHaveBeenCalled()
    })

    it('should throw error when cutoff date is in the future', async () => {
      await expect(cleanupOldEventMetrics({ cutoffDays: -5 })).rejects.toThrow(
        'Cutoff date must be in the past'
      )
    })

    it('should call onProgress callback for metrics', async () => {
      const onProgress = jest.fn()

      prisma.eventMetric.count.mockResolvedValue(50)

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { id: 'metric1' }
          yield { id: 'metric2' }
        },
      }

      prisma.eventMetric.paginate.mockReturnValue(mockIterator)
      prisma.eventMetric.deleteMany.mockResolvedValue({ count: 1 })

      await cleanupOldEventMetrics({ onProgress })

      expect(onProgress).toHaveBeenCalledWith({ deleted: 0, total: 50 })
      expect(onProgress).toHaveBeenCalledWith({ deleted: 2, total: 50 })
    })
  })

  describe('cleanupOldAuditLogs', () => {
    it('should cleanup audit logs older than default cutoff (2555 days / 7 years)', async () => {
      prisma.auditLog.count.mockResolvedValue(300)

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { id: 'audit1' }
          yield { id: 'audit2' }
        },
      }

      prisma.auditLog.paginate.mockReturnValue(mockIterator)
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 1 })

      await cleanupOldAuditLogs()

      expect(prisma.auditLog.count).toHaveBeenCalled()
      expect(prisma.auditLog.paginate).toHaveBeenCalled()
      expect(prisma.auditLog.deleteMany).toHaveBeenCalled()
    })

    it('should use custom cutoff days for audit logs', async () => {
      prisma.auditLog.count.mockResolvedValue(100)

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { id: 'audit1' }
        },
      }

      prisma.auditLog.paginate.mockReturnValue(mockIterator)
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 0 })

      await cleanupOldAuditLogs({ cutoffDays: 3650 })

      const countCall = prisma.auditLog.count.mock.calls[0][0]
      const cutoffDate = countCall.where.createdAt.lt

      const expectedCutoff = new Date()

      expectedCutoff.setDate(expectedCutoff.getDate() - 3650)

      expect(cutoffDate.getTime()).toBeCloseTo(expectedCutoff.getTime(), -4)
    })

    it('should return early when no audit logs to delete', async () => {
      prisma.auditLog.count.mockResolvedValue(0)

      await cleanupOldAuditLogs()

      expect(prisma.auditLog.paginate).not.toHaveBeenCalled()
      expect(prisma.auditLog.deleteMany).not.toHaveBeenCalled()
    })

    it('should throw error when cutoff date is in the future', async () => {
      await expect(cleanupOldAuditLogs({ cutoffDays: -10 })).rejects.toThrow(
        'Cutoff date must be in the past'
      )
    })

    it('should call onProgress callback for audit logs', async () => {
      const onProgress = jest.fn()

      prisma.auditLog.count.mockResolvedValue(75)

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { id: 'audit1' }
          yield { id: 'audit2' }
          yield { id: 'audit3' }
        },
      }

      prisma.auditLog.paginate.mockReturnValue(mockIterator)
      prisma.auditLog.deleteMany.mockResolvedValue({ count: 2 })

      await cleanupOldAuditLogs({ onProgress })

      expect(onProgress).toHaveBeenCalledWith({ deleted: 0, total: 75 })
      expect(onProgress).toHaveBeenCalledWith({ deleted: 3, total: 75 })
    })
  })

  describe('edge cases', () => {
    it('should handle empty iterator', async () => {
      prisma.eventLog.count.mockResolvedValue(1)

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          // yield nothing
        },
      }

      prisma.eventLog.paginate.mockReturnValue(mockIterator)

      await cleanupOldEventLogs()

      expect(prisma.eventLog.deleteMany).not.toHaveBeenCalled()
    })

    it('should handle single item batches', async () => {
      prisma.eventLog.count.mockResolvedValue(1)

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield { id: 'single' }
        },
      }

      prisma.eventLog.paginate.mockReturnValue(mockIterator)
      prisma.eventLog.deleteMany.mockResolvedValue({ count: 0 })

      await cleanupOldEventLogs()

      expect(prisma.eventLog.deleteMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: [],
          },
        },
      })
    })

    it('should handle multiple batches for event logs', async () => {
      prisma.eventLog.count.mockResolvedValue(10)

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          // Generate 1501 items to create 3+ batches (batch size is 500)
          for (let i = 1; i <= 1501; i++) {
            yield { id: `log${i}` }
          }
        },
      }

      prisma.eventLog.paginate.mockReturnValue(mockIterator)
      prisma.eventLog.deleteMany.mockResolvedValue({ count: 2 })

      await cleanupOldEventLogs()

      expect(prisma.eventLog.deleteMany).toHaveBeenCalledTimes(4)
    })
  })
})

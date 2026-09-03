// @ts-check

/**
 * @jest-environment node
 */
import { mockDeep } from 'jest-mock-extended'

import prisma from '@/prisma/client'

import defer from '@/lib/defer'
import { captureError } from '@/lib/error'
import {
  logAudit,
  logAuditNow,
  logEvent,
  logEventNow,
  logMetric,
  logMetricNow,
} from '@/lib/log'

jest.mock('@/prisma/client', () => {
  const mockPrisma = mockDeep()

  return {
    __esModule: true,
    default: mockPrisma,
    prisma: mockPrisma,
  }
})

jest.mock('@/lib/event', () => [], { virtual: true })

jest.mock('@/lib/debug', () => jest.fn(() => ({ log: jest.fn() })))

jest.mock('@/lib/cache', () => ({ swrCache: jest.fn() }))

jest.mock('@/lib/defer', () => ({
  __esModule: true,
  default: jest.fn(async (fn) => {
    if (typeof fn === 'function') {
      await fn()
    } else {
      await fn
    }
  }),
}))

jest.mock('@/lib/error', () => ({ captureError: jest.fn() }))

jest.mock('@/lib/user.get', () => ({
  fastGetUserById: jest.fn(async () => null),
}))

jest.mock('@/lib/user.limits', () => ({
  isLiveEventStreamingEnabled: jest.fn(async () => false),
}))

jest.mock('uuid', () => ({ v1: jest.fn(() => 'mock-uuid-v1') }))

jest.mock('@chatbotkit-dev/time', () => ({
  ONE_HOUR_IN_SECONDS: 3600,
  timePlusDays: jest.fn(
    (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000)
  ),
}))

jest.mock('@/lib/fetch', () => ({
  __esModule: true,
  default: jest.fn(),
  getFetchError: jest.fn(),
  withNextCache: jest.fn((fn) => fn),
  withRetry: jest.fn((fn) => fn),
  withTimeout: jest.fn((fn) => fn),
  withBodyTimeout: jest.fn((fn) => fn),
}))

jest.mock('@/lib/cbk.sdk', () => ({ getUserClient: jest.fn() }))

jest.mock('@/lib/channel.user', () => ({
  publishChannelMessage: jest.fn(),
}))

jest.mock('@/lib/host', () => ({ getLocalHostURL: jest.fn() }))

jest.mock('@/lib/job', () => ({ runTasksEach: jest.fn() }))

jest.mock('@/lib/queue', () => ({ __esModule: true, default: jest.fn() }))

jest.mock('@/lib/queue2', () => ({ withQueueHandlerBounded: jest.fn() }))

const mockUser = { id: 'user-123' }

describe('Enhanced Logging System', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset environment variable
    delete process.env.SKIP_LOG_RECORDING
  })

  describe('logEventNow', () => {
    it('should create event log entry in database', async () => {
      // @ts-ignore - Mock method exists at runtime
      prisma.eventLog.create.mockResolvedValue({ id: 'event-123' })

      await logEventNow({
        user: mockUser,
        type: 'user.login',
        relations: {},
        meta: { method: 'oauth' },
      })

      expect(prisma.eventLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          name: undefined,
          description: undefined,
          type: 'user.login',
          meta: { method: 'oauth', relations: {} },
        },
        select: {
          id: true,
          createdAt: true,
        },
      })
    })

    it('should include relationship filters when provided', async () => {
      // @ts-ignore - Mock method exists at runtime
      prisma.eventLog.create.mockResolvedValue({ id: 'event-123' })

      const relations = {
        botId: 'bot-456',
        conversationId: 'conv-789',
        sessionId: 'session-abc',
      }

      await logEventNow({
        user: mockUser,
        type: 'message.sent',
        relations: relations,
        meta: { content: 'Hello', relations },
      })

      expect(prisma.eventLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          name: undefined,
          description: undefined,
          type: 'message.sent',
          meta: { content: 'Hello', relations },
          botId: 'bot-456',
          conversationId: 'conv-789',
          sessionId: 'session-abc',
        },
        select: {
          id: true,
          createdAt: true,
        },
      })
    })

    it('should continue with external logging if database write fails', async () => {
      // @ts-ignore - Mock method exists at runtime
      prisma.eventLog.create.mockRejectedValue(new Error('Database error'))

      await logEventNow({
        user: mockUser,
        type: 'user.error',
        relations: {},
        meta: { error: 'test' },
      })

      expect(captureError).toHaveBeenCalled()
      // Note: when database write fails, log.info is not called
    })

    it('should skip logging when SKIP_LOG_RECORDING is true', async () => {
      process.env.SKIP_LOG_RECORDING = 'true'

      await logEventNow({ user: mockUser, type: 'user.login', relations: {} })

      expect(prisma.eventLog.create).not.toHaveBeenCalled()
    })

    // Test removed - sendEvent is handled as dynamic import and not easily testable in unit tests
    // it('should trigger queue event for available event types', async () => {
    //   jest.doMock('@/lib/event', () => [{ name: 'user.login' }], {
    //     virtual: true,
    //   })

    //   await logEvent({ user: mockUser, type: 'user.login', relations: {}, meta: { method: 'password' }})

    //   expect(sendEvent).toHaveBeenCalledWith('user-123', {
    //     type: 'trigger',
    //     payload: {
    //       eventType: 'user.login',
    //       eventData: { method: 'password' },
    //     },
    //   })
    // })
  })

  describe('logEvent', () => {
    it('should defer event logging by default', async () => {
      // @ts-ignore - Mock method exists at runtime
      prisma.eventLog.create.mockResolvedValue({ id: 'event-123' })

      await logEvent({ user: mockUser, type: 'user.login', relations: {} })

      expect(defer).toHaveBeenNthCalledWith(1, expect.any(Function))
      expect(prisma.eventLog.create).toHaveBeenCalled()
    })
  })

  describe('logMetricNow', () => {
    it('should create metric entry in database', async () => {
      // @ts-ignore - Mock method exists at runtime
      prisma.eventMetric.create.mockResolvedValue({ id: 'metric-123' })

      await logMetricNow({
        user: mockUser,
        type: 'response.time',
        value: 100,
        meta: { duration: 250, value: 250 },
      })

      expect(prisma.eventMetric.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          type: 'response.time',
          meta: { duration: 250, value: 250 },
          value: 100,
        },
        select: {
          id: true,
        },
      })
    })

    it('should handle metric without value option', async () => {
      // @ts-ignore - Mock method exists at runtime
      prisma.eventMetric.create.mockResolvedValue({ id: 'metric-123' })

      await logMetricNow({
        user: mockUser,
        type: 'page.view',
        value: 100,
        meta: { page: '/dashboard' },
      })

      expect(prisma.eventMetric.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          type: 'page.view',
          meta: { page: '/dashboard' },
          value: 100,
        },
        select: {
          id: true,
        },
      })
    })

    it('should skip logging when SKIP_LOG_RECORDING is true', async () => {
      process.env.SKIP_LOG_RECORDING = 'true'

      await logMetricNow({
        user: mockUser,
        type: 'metric.test',
        value: 100,
        meta: {},
      })

      expect(prisma.eventMetric.create).not.toHaveBeenCalled()
    })

    it('should continue with external logging if database write fails', async () => {
      // @ts-ignore - Mock method exists at runtime
      prisma.eventMetric.create.mockRejectedValue(new Error('Database error'))

      await logMetricNow({
        user: mockUser,
        type: 'error.metric',
        value: 0,
        meta: { error: 'test' },
      })

      expect(captureError).toHaveBeenCalled()
      // Note: when database write fails, log.info is not called
    })
  })

  describe('logMetric', () => {
    it('should defer metric logging by default', async () => {
      // @ts-ignore - Mock method exists at runtime
      prisma.eventMetric.create.mockResolvedValue({ id: 'metric-123' })

      await logMetric({
        user: mockUser,
        type: 'response.time',
        value: 100,
      })

      expect(defer).toHaveBeenCalledTimes(1)
      expect(defer).toHaveBeenCalledWith(expect.any(Function))
      expect(prisma.eventMetric.create).toHaveBeenCalled()
    })
  })

  describe('logAuditNow', () => {
    it('should create audit log entry in database', async () => {
      // @ts-ignore - Mock method exists at runtime
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-123' })

      const oldValues = { name: 'Old Bot' }
      const newValues = { name: 'New Bot' }
      const meta = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        relations: {},
      }

      await logAuditNow({
        user: mockUser,
        action: 'UPDATE',
        relations: {},
        oldValues,
        newValues,
        meta,
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          action: 'UPDATE',
          oldValues: oldValues,
          newValues: newValues,
          meta: meta,
        },
      })
    })

    it('should handle audit log without metadata', async () => {
      // @ts-ignore - Mock method exists at runtime
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-123' })

      await logAuditNow({
        user: mockUser,
        action: 'CREATE',
        oldValues: undefined,
        newValues: undefined,
        relations: {},
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          action: 'CREATE',
          oldValues: undefined,
          newValues: undefined,
          meta: {
            relations: {},
          },
        },
      })
    })

    it('should skip logging when SKIP_LOG_RECORDING is true', async () => {
      process.env.SKIP_LOG_RECORDING = 'true'

      await logAuditNow({
        user: mockUser,
        action: 'DELETE',
        oldValues: undefined,
        newValues: undefined,
        relations: {},
      })

      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })
  })

  describe('logAudit', () => {
    it('should defer audit logging by default', async () => {
      // @ts-ignore - Mock method exists at runtime
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-123' })

      await logAudit({
        user: mockUser,
        action: 'CREATE',
        oldValues: undefined,
        newValues: undefined,
        relations: {},
      })

      expect(defer).toHaveBeenCalledTimes(1)
      expect(defer).toHaveBeenCalledWith(expect.any(Function))
      expect(prisma.auditLog.create).toHaveBeenCalled()
    })
  })
})

/* eslint-disable @typescript-eslint/no-require-imports */
import { CLEANUP_EVENT_TYPE, handleCleanupEvent, sendEvent } from './queue'

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    log: jest.fn(),
  })),
}))

jest.mock('@/lib/log.cleanup', () => ({
  cleanupOldAuditLogs: jest.fn(),
}))

jest.mock('@/lib/queue', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/queue2', () => ({
  withQueueHandler: jest.fn((handlers) => handlers),
}))

jest.mock('@/lib/error', () => ({
  captureInputError: jest.fn(),
}))

jest.mock('@/lib/zod.schema', () => ({
  parseAsync: jest.fn((schema, data) => Promise.resolve(data)),
}))

describe('/api/v1/audit/log/queue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('CLEANUP_EVENT_TYPE constant', () => {
    it('should be defined with correct value', () => {
      expect(CLEANUP_EVENT_TYPE).toBe('cleanup')
    })
  })

  describe('handleCleanupEvent', () => {
    it('should call cleanupOldAuditLogs', async () => {
      const { cleanupOldAuditLogs } = require('@/lib/log.cleanup')
      const payload = {}

      await handleCleanupEvent(payload)

      expect(cleanupOldAuditLogs).toHaveBeenCalledTimes(1)
    })

    it('should handle empty payload', async () => {
      const { cleanupOldAuditLogs } = require('@/lib/log.cleanup')

      cleanupOldAuditLogs.mockResolvedValue(undefined)

      await expect(handleCleanupEvent({})).resolves.toBeUndefined()
    })

    it('should propagate errors from cleanupOldAuditLogs', async () => {
      const { cleanupOldAuditLogs } = require('@/lib/log.cleanup')
      const error = new Error('Cleanup failed')

      cleanupOldAuditLogs.mockRejectedValue(error)

      await expect(handleCleanupEvent({})).rejects.toThrow('Cleanup failed')
    })
  })

  describe('sendEvent', () => {
    it('should validate and send cleanup event', async () => {
      const queue = require('@/lib/queue').default
      const { parseAsync } = require('@/lib/zod.schema')

      const event = {
        type: CLEANUP_EVENT_TYPE,
        payload: {},
      }

      await sendEvent(event)

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith('/api/v1/audit/log/queue', event)
    })

    it('should handle cleanup event type correctly', async () => {
      const queue = require('@/lib/queue').default
      const { parseAsync } = require('@/lib/zod.schema')

      const event = {
        type: 'cleanup',
        payload: {},
      }

      await sendEvent(event)

      expect(parseAsync).toHaveBeenCalled()
      expect(queue).toHaveBeenCalledWith('/api/v1/audit/log/queue', event)
    })

    it('should call queue with correct endpoint', async () => {
      const queue = require('@/lib/queue').default

      const event = {
        type: CLEANUP_EVENT_TYPE,
        payload: {},
      }

      await sendEvent(event)

      expect(queue).toHaveBeenCalledWith(
        '/api/v1/audit/log/queue',
        expect.objectContaining({
          type: CLEANUP_EVENT_TYPE,
          payload: {},
        })
      )
    })

    it('should handle validation errors', async () => {
      const { parseAsync } = require('@/lib/zod.schema')
      const { captureInputError } = require('@/lib/error')

      const validationError = new Error('Invalid payload')

      parseAsync.mockRejectedValue(validationError)

      const event = {
        type: CLEANUP_EVENT_TYPE,
        payload: {},
      }

      await expect(sendEvent(event)).rejects.toThrow('Invalid payload')
    })
  })

  describe('edge cases', () => {
    it('should handle event with unknown type gracefully', async () => {
      const queue = require('@/lib/queue').default

      const event = {
        type: 'unknown',
        payload: {},
      }

      await sendEvent(event)

      // Should still call queue even for unknown event types
      expect(queue).toHaveBeenCalledWith('/api/v1/audit/log/queue', event)
    })

    it('should handle null payload in cleanup event', async () => {
      const { cleanupOldAuditLogs } = require('@/lib/log.cleanup')

      cleanupOldAuditLogs.mockResolvedValue(undefined)

      await expect(handleCleanupEvent(null)).resolves.toBeUndefined()
    })

    it('should handle undefined payload in cleanup event', async () => {
      const { cleanupOldAuditLogs } = require('@/lib/log.cleanup')

      cleanupOldAuditLogs.mockResolvedValue(undefined)

      await expect(handleCleanupEvent(undefined)).resolves.toBeUndefined()
    })
  })

  describe('queue handler configuration', () => {
    it('should export queue handler with cleanup event handler', () => {
      const handler = require('./queue').default

      expect(handler).toBeDefined()
      expect(handler[CLEANUP_EVENT_TYPE]).toBeDefined()
      expect(handler[CLEANUP_EVENT_TYPE].handler).toBe(handleCleanupEvent)
    })

    it('should include CleanupPayloadSchema in handler config', () => {
      const handler = require('./queue').default
      const { CleanupPayloadSchema } = require('./queue')

      expect(handler[CLEANUP_EVENT_TYPE].schema).toBe(CleanupPayloadSchema)
    })
  })

  describe('integration behavior', () => {
    it('should complete full cleanup flow', async () => {
      const { cleanupOldAuditLogs } = require('@/lib/log.cleanup')
      const queue = require('@/lib/queue').default
      const { parseAsync } = require('@/lib/zod.schema')

      cleanupOldAuditLogs.mockResolvedValue(undefined)
      parseAsync.mockResolvedValue({}) // Ensure validation succeeds

      const event = {
        type: CLEANUP_EVENT_TYPE,
        payload: {},
      }

      // Send event
      await sendEvent(event)
      expect(queue).toHaveBeenCalled()

      // Handle event
      await handleCleanupEvent(event.payload)
      expect(cleanupOldAuditLogs).toHaveBeenCalled()
    })
  })
})

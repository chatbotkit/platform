import debug from '@/lib/debug'
import { cleanupOldEventLogs } from '@/lib/log.cleanup'
import queue from '@/lib/queue'

import {
  CLEANUP_EVENT_TYPE,
  CleanupPayloadSchema,
  handleCleanupEvent,
  sendEvent,
} from './queue'

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({ log: jest.fn() })),
}))

jest.mock('@/lib/log.cleanup', () => ({
  __esModule: true,
  cleanupOldEventLogs: jest.fn(),
}))

jest.mock('@/lib/queue', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/queue2', () => ({
  __esModule: true,
  withQueueHandler: jest.fn((handlers) => handlers),
}))

describe('event log queue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('CLEANUP_EVENT_TYPE', () => {
    it('should be defined as cleanup', () => {
      expect(CLEANUP_EVENT_TYPE).toBe('cleanup')
    })
  })

  describe('CleanupPayloadSchema', () => {
    it('should accept empty object', () => {
      const result = CleanupPayloadSchema.safeParse({})

      expect(result.success).toBe(true)
    })

    it('should accept additional properties', () => {
      const result = CleanupPayloadSchema.safeParse({
        extra: 'property',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('handleCleanupEvent', () => {
    it('should log cleanup event', async () => {
      const payload = {}
      const mockLog = jest.fn()

      debug.mockReturnValue({ log: mockLog })

      await handleCleanupEvent(payload)

      expect(debug).toHaveBeenCalledWith('cleanup', { payload })
      expect(mockLog).toHaveBeenCalledWith('event.log.queue.handleCleanupEvent')
    })

    it('should call cleanupOldEventLogs', async () => {
      const payload = {}

      await handleCleanupEvent(payload)

      expect(cleanupOldEventLogs).toHaveBeenCalledTimes(1)
    })

    it('should handle payload with properties', async () => {
      const payload = { someProperty: 'value' }
      const mockLog = jest.fn()

      debug.mockReturnValue({ log: mockLog })

      await handleCleanupEvent(payload)

      expect(debug).toHaveBeenCalledWith('cleanup', { payload })
      expect(cleanupOldEventLogs).toHaveBeenCalled()
    })

    it('should complete successfully', async () => {
      const payload = {}

      cleanupOldEventLogs.mockResolvedValue()

      await expect(handleCleanupEvent(payload)).resolves.toBeUndefined()
    })

    it('should propagate errors from cleanupOldEventLogs', async () => {
      const payload = {}
      const error = new Error('Cleanup failed')

      cleanupOldEventLogs.mockRejectedValue(error)

      await expect(handleCleanupEvent(payload)).rejects.toThrow(
        'Cleanup failed'
      )
    })
  })

  describe('sendEvent', () => {
    it('should send cleanup event to queue', async () => {
      const event = {
        type: CLEANUP_EVENT_TYPE,
        payload: {},
      }

      await sendEvent(event)

      expect(queue).toHaveBeenCalledWith('/api/v1/event/log/queue', event)
    })

    it('should validate payload before sending', async () => {
      const event = {
        type: CLEANUP_EVENT_TYPE,
        payload: {},
      }

      await expect(sendEvent(event)).resolves.toBeUndefined()
    })

    it('should send event with additional payload properties', async () => {
      const event = {
        type: CLEANUP_EVENT_TYPE,
        payload: { extra: 'data' },
      }

      await sendEvent(event)

      expect(queue).toHaveBeenCalledWith('/api/v1/event/log/queue', event)
    })
  })
})

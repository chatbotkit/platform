import debug from '@/lib/debug'
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

jest.mock('@/lib/queue', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/queue2', () => ({
  __esModule: true,
  withQueueHandler: jest.fn((handlers) => handlers),
}))

describe('dataset queue', () => {
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
      expect(mockLog).toHaveBeenCalledWith('dataset.queue.handleCleanupEvent')
    })

    it('should handle payload with properties', async () => {
      const payload = { someProperty: 'value' }
      const mockLog = jest.fn()

      debug.mockReturnValue({ log: mockLog })

      await handleCleanupEvent(payload)

      expect(debug).toHaveBeenCalledWith('cleanup', { payload })
      expect(mockLog).toHaveBeenCalledWith('dataset.queue.handleCleanupEvent')
    })

    it('should complete without errors', async () => {
      const payload = {}

      await expect(handleCleanupEvent(payload)).resolves.toBeUndefined()
    })
  })

  describe('sendEvent', () => {
    it('should send cleanup event to queue', async () => {
      const event = {
        type: CLEANUP_EVENT_TYPE,
        payload: {},
      }

      await sendEvent(event)

      expect(queue).toHaveBeenCalledWith('/api/v1/dataset/queue', event)
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

      expect(queue).toHaveBeenCalledWith('/api/v1/dataset/queue', event)
    })
  })
})

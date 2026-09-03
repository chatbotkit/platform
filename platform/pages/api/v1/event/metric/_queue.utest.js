/* eslint-disable @typescript-eslint/no-require-imports */
import { CLEANUP_EVENT_TYPE, handleCleanupEvent, sendEvent } from './queue'

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    log: jest.fn(),
  })),
}))

jest.mock('@/lib/log.cleanup', () => ({
  cleanupOldEventMetrics: jest.fn(),
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

describe('/api/v1/event/metric/queue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should define cleanup event type', () => {
    expect(CLEANUP_EVENT_TYPE).toBe('cleanup')
  })

  it('should cleanup metrics when handling cleanup event', async () => {
    const { cleanupOldEventMetrics } = require('@/lib/log.cleanup')

    await handleCleanupEvent({})

    expect(cleanupOldEventMetrics).toHaveBeenCalledTimes(1)
  })

  it('should validate and queue cleanup event', async () => {
    const queue = require('@/lib/queue').default
    const { parseAsync } = require('@/lib/zod.schema')
    const event = { type: CLEANUP_EVENT_TYPE, payload: {} }

    await sendEvent(event)

    expect(parseAsync).toHaveBeenCalled()
    expect(queue).toHaveBeenCalledWith('/api/v1/event/metric/queue', event)
  })

  it('should still queue unknown event types without validation', async () => {
    const queue = require('@/lib/queue').default
    const { parseAsync } = require('@/lib/zod.schema')
    const event = { type: 'unknown', payload: {} }

    await sendEvent(event)

    expect(parseAsync).not.toHaveBeenCalled()
    expect(queue).toHaveBeenCalledWith('/api/v1/event/metric/queue', event)
  })

  it('should propagate validation errors', async () => {
    const { parseAsync } = require('@/lib/zod.schema')

    parseAsync.mockRejectedValue(new Error('Invalid payload'))

    await expect(
      sendEvent({ type: CLEANUP_EVENT_TYPE, payload: {} })
    ).rejects.toThrow('Invalid payload')
  })
})

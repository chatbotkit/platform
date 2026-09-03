/**
 * @jest-environment node
 */
import prisma from '@/prisma/client'

import queue from '@/lib/queue'

import {
  CLEANUP_EVENT_TYPE,
  CleanupPayloadSchema,
  handleCleanupEvent,
  sendEvent,
} from './queue'

jest.mock('@/prisma/client', () => ({
  __esModule: true,
  default: {
    session: {
      deleteMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/queue', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/lib/queue2', () => ({
  withQueueHandler: (handlers) => handlers,
}))

describe('Session queue handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('handleCleanupEvent', () => {
    it('deletes sessions with an expiry in the past', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 3 })

      await handleCleanupEvent({})

      expect(prisma.session.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            expires: {
              lt: expect.any(Date),
            },
          },
        })
      )
    })

    it('uses the current time as the expiry threshold', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 0 })

      const before = new Date()

      await handleCleanupEvent({})

      const after = new Date()

      const threshold =
        prisma.session.deleteMany.mock.calls[0][0].where.expires.lt

      expect(threshold.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(threshold.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it('resolves successfully when no sessions are expired', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 0 })

      await expect(handleCleanupEvent({})).resolves.not.toThrow()
    })

    it('propagates database errors', async () => {
      const dbError = new Error('Database unavailable')

      prisma.session.deleteMany.mockRejectedValue(dbError)

      await expect(handleCleanupEvent({})).rejects.toThrow(
        'Database unavailable'
      )
    })
  })

  describe('sendEvent', () => {
    it('queues a cleanup event with the correct path', async () => {
      await sendEvent({ type: CLEANUP_EVENT_TYPE, payload: {} })

      expect(queue).toHaveBeenCalledWith('/api/session/queue', {
        type: CLEANUP_EVENT_TYPE,
        payload: {},
      })
    })

    it('validates the cleanup payload schema before queuing', async () => {
      await expect(
        sendEvent({ type: CLEANUP_EVENT_TYPE, payload: {} })
      ).resolves.not.toThrow()
    })

    it('still queues the event for unknown event types without schema validation', async () => {
      const unknownEvent = { type: 'unknown', payload: { foo: 'bar' } }

      await sendEvent(unknownEvent)

      expect(queue).toHaveBeenCalledWith('/api/session/queue', unknownEvent)
    })
  })

  describe('CleanupPayloadSchema', () => {
    it('accepts an empty payload', async () => {
      await expect(CleanupPayloadSchema.parseAsync({})).resolves.toEqual({})
    })

    it('has the expected CLEANUP_EVENT_TYPE constant', () => {
      expect(CLEANUP_EVENT_TYPE).toBe('cleanup')
    })
  })
})

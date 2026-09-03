import {
  isBenignChannelTermination,
  streamConversationMonitorEvents,
} from '@/lib/conversation.monitor.channel'

import { streamChannelEvents } from '@/lib/channel.user'
import { captureUnexpectedState } from '@/lib/error'
import { sleep } from '@/lib/promise'

jest.mock('@/lib/channel.user', () => ({
  streamChannelEvents: jest.fn(),
  publishChannelMessage: jest.fn(),
}))

jest.mock('@/lib/promise', () => ({
  sleep: jest.fn(async () => null),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(async () => undefined),
  captureUnexpectedState: jest.fn(async () => undefined),
}))

jest.mock('@/lib/debug', () => ({
  __esModule: true,
  default: () => ({ log: () => undefined }),
}))

const mockStreamChannelEvents = streamChannelEvents as jest.Mock
const mockSleep = sleep as jest.Mock
const mockCaptureUnexpectedState = captureUnexpectedState as jest.Mock

/** Build a benign undici-style termination error. */
function terminatedError(): Error {
  const error = new TypeError('terminated')

  ;(error as { cause?: unknown }).cause = { code: 'UND_ERR_BODY_TIMEOUT' }

  return error
}

/** Drain an async iterable into an array. */
async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = []

  for await (const item of iterable) {
    items.push(item)
  }

  return items
}

describe('conversation.monitor.channel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('isBenignChannelTermination', () => {
    it('treats undici "terminated" TypeError as benign', () => {
      expect(isBenignChannelTermination(terminatedError())).toBe(true)
    })

    it('treats UND_ERR_BODY_TIMEOUT / ECONNRESET codes as benign', () => {
      expect(
        isBenignChannelTermination({ code: 'UND_ERR_BODY_TIMEOUT' })
      ).toBe(true)
      expect(isBenignChannelTermination({ code: 'ECONNRESET' })).toBe(true)
    })

    it('does not treat arbitrary errors as benign', () => {
      expect(isBenignChannelTermination(new Error('boom'))).toBe(false)
      expect(isBenignChannelTermination({ code: 'EAUTH' })).toBe(false)
      expect(isBenignChannelTermination(null)).toBe(false)
    })
  })

  describe('streamConversationMonitorEvents', () => {
    it('reconnects after a benign termination and keeps yielding', async () => {
      mockStreamChannelEvents
        .mockImplementationOnce(async function* () {
          throw terminatedError()
        })
        .mockImplementationOnce(async function* () {
          yield { type: 'message', channel: 'c', data: { ok: true } }
        })

      const events: unknown[] = []

      for await (const event of streamConversationMonitorEvents(
        'user-1',
        'conv-1'
      )) {
        events.push(event)

        break // stop once we receive the post-reconnect event
      }

      expect(events).toEqual([
        { type: 'message', channel: 'c', data: { ok: true } },
      ])

      // first connect threw benign -> a second connect happened
      expect(mockStreamChannelEvents).toHaveBeenCalledTimes(2)
      expect(mockSleep).toHaveBeenCalledTimes(1)
    })

    it('replays history only on the first connect', async () => {
      mockStreamChannelEvents
        .mockImplementationOnce(async function* () {
          throw terminatedError()
        })
        .mockImplementationOnce(async function* () {
          yield { type: 'message', channel: 'c', data: {} }
        })

      for await (const _event of streamConversationMonitorEvents(
        'user-1',
        'conv-1',
        { historyLength: 50 }
      )) {
        break
      }

      expect(mockStreamChannelEvents).toHaveBeenNthCalledWith(
        1,
        'user-1',
        expect.any(String),
        expect.objectContaining({ historyLength: 50 })
      )
      expect(mockStreamChannelEvents).toHaveBeenNthCalledWith(
        2,
        'user-1',
        expect.any(String),
        expect.objectContaining({ historyLength: undefined })
      )
    })

    it('ends cleanly without reconnecting when the caller aborts', async () => {
      const abortSignal = { aborted: false } as unknown as AbortSignal

      mockStreamChannelEvents.mockImplementationOnce(async function* () {
        ;(abortSignal as { aborted: boolean }).aborted = true

        throw new Error('aborted read')
      })

      const events = await collect(
        streamConversationMonitorEvents('user-1', 'conv-1', { abortSignal })
      )

      expect(events).toEqual([])
      expect(mockStreamChannelEvents).toHaveBeenCalledTimes(1)
    })

    it('surfaces a non-benign error instead of reconnecting', async () => {
      mockStreamChannelEvents.mockImplementationOnce(async function* () {
        throw new Error('boom')
      })

      await expect(
        collect(streamConversationMonitorEvents('user-1', 'conv-1'))
      ).rejects.toThrow('boom')

      expect(mockStreamChannelEvents).toHaveBeenCalledTimes(1)
    })

    it('gives up and reports after too many rapid reconnects', async () => {
      mockStreamChannelEvents.mockImplementation(async function* () {
        throw terminatedError()
      })

      const events = await collect(
        streamConversationMonitorEvents('user-1', 'conv-1')
      )

      expect(events).toEqual([])

      // MONITOR_MAX_RAPID_RECONNECTS (5) + 1 attempts before giving up
      expect(mockStreamChannelEvents).toHaveBeenCalledTimes(6)
      expect(mockCaptureUnexpectedState).toHaveBeenCalledTimes(1)
    })
  })
})

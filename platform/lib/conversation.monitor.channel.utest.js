/* eslint-disable @typescript-eslint/no-require-imports */
import {
  CONVERSATION_MONITOR_CHANNEL_HISTORY_EXPIRE_SECONDS,
  CONVERSATION_MONITOR_CHANNEL_HISTORY_LENGTH,
  createConversationMonitorSink,
  getConversationMonitorChannelName,
  isBenignChannelTermination,
  streamConversationMonitorEvents,
} from './conversation.monitor.channel'

jest.mock('@/lib/channel.user', () => ({
  publishChannelMessage: jest.fn(),
  streamChannelEvents: jest.fn(),
}))

jest.mock('@/lib/error', () => ({
  captureError: jest.fn(),
  captureUnexpectedState: jest.fn(),
}))

jest.mock('@/lib/promise', () => ({
  ...jest.requireActual('@/lib/promise'),
  sleep: jest.fn(() => Promise.resolve()),
}))

jest.mock('@/lib/debug', () =>
  jest.fn(() => ({
    log: jest.fn(() => undefined),
  }))
)

const {
  publishChannelMessage,
  streamChannelEvents,
} = require('@/lib/channel.user')
const { captureError, captureUnexpectedState } = require('@/lib/error')
const { sleep } = require('@/lib/promise')

describe('conversation.monitor.channel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    // restore any Date.now spies installed per-test
    jest.restoreAllMocks()
  })

  describe('getConversationMonitorChannelName', () => {
    it('builds a stable monitor channel name from conversation id', () => {
      expect(getConversationMonitorChannelName('conv-123')).toBe(
        'conversation[conv-123]:monitor'
      )
    })
  })

  describe('isBenignChannelTermination', () => {
    it('treats an undici terminated TypeError as benign', () => {
      expect(isBenignChannelTermination(new TypeError('terminated'))).toBe(true)
    })

    it('treats known transient codes as benign', () => {
      expect(isBenignChannelTermination({ code: 'UND_ERR_BODY_TIMEOUT' })).toBe(
        true
      )
      expect(
        isBenignChannelTermination({ cause: { code: 'ECONNRESET' } })
      ).toBe(true)
    })

    it('treats real errors and non-objects as non-benign', () => {
      expect(isBenignChannelTermination(new Error('auth failed'))).toBe(false)
      expect(isBenignChannelTermination(null)).toBe(false)
      expect(isBenignChannelTermination('terminated')).toBe(false)
    })
  })

  describe('streamConversationMonitorEvents', () => {
    it('streams events from the scoped conversation monitor channel', async () => {
      const events = [
        { type: 'message', data: { text: 'hello' } },
        { type: 'completeEnd', data: { instance: 'i', iteration: '1' } },
      ]

      // a real consumer aborts (client disconnect) once it has what it needs;
      // simulate that so the long-lived reconnect loop ends cleanly
      const controller = new AbortController()

      streamChannelEvents.mockImplementation(async function* () {
        for (const event of events) {
          yield event
        }

        controller.abort()
      })

      const received = []

      for await (const event of streamConversationMonitorEvents(
        'user-1',
        'conv-1',
        { historyLength: 5, abortSignal: controller.signal }
      )) {
        received.push(event)
      }

      expect(streamChannelEvents).toHaveBeenCalledTimes(1)
      expect(streamChannelEvents).toHaveBeenCalledWith(
        'user-1',
        'conversation[conv-1]:monitor',
        expect.objectContaining({
          historyLength: 5,
          abortSignal: controller.signal,
        })
      )
      expect(received).toEqual(events)
      expect(captureUnexpectedState).not.toHaveBeenCalled()
    })

    it('reconnects after a benign idle drop and replays history only once', async () => {
      // connection 1 lasts long enough to look healthy, then idle-drops;
      // connection 2 delivers a late event and the caller aborts
      const times = [0, 10000, 20000]
      let tick = 0

      jest.spyOn(Date, 'now').mockImplementation(() => times[tick++] ?? 30000)

      const controller = new AbortController()

      streamChannelEvents
        .mockImplementationOnce(async function* () {
          yield { type: 'message', data: { text: 'a' } }

          throw new TypeError('terminated')
        })
        .mockImplementationOnce(async function* () {
          yield { type: 'completeEnd', data: {} }

          controller.abort()
        })

      const received = []

      for await (const event of streamConversationMonitorEvents(
        'user-1',
        'conv-1',
        { historyLength: 7, abortSignal: controller.signal }
      )) {
        received.push(event)
      }

      expect(received).toEqual([
        { type: 'message', data: { text: 'a' } },
        { type: 'completeEnd', data: {} },
      ])

      expect(streamChannelEvents).toHaveBeenCalledTimes(2)
      // history replayed on the first connect...
      expect(streamChannelEvents.mock.calls[0][2].historyLength).toBe(7)
      // ...but never again on reconnect
      expect(streamChannelEvents.mock.calls[1][2].historyLength).toBeUndefined()

      // a healthy-length connection must not be throttled
      expect(sleep).not.toHaveBeenCalled()
      expect(captureUnexpectedState).not.toHaveBeenCalled()
    })

    it('surfaces a non-benign subscribe error to the caller', async () => {
      const fatal = new Error('auth failed')

      streamChannelEvents.mockImplementation(async function* () {
        throw fatal

        // eslint-disable-next-line no-unreachable
        yield undefined
      })

      const iterate = async () => {
        // eslint-disable-next-line no-unused-vars
        for await (const _event of streamConversationMonitorEvents(
          'user-1',
          'conv-1'
        )) {
          // no-op
        }
      }

      await expect(iterate()).rejects.toBe(fatal)
      expect(streamChannelEvents).toHaveBeenCalledTimes(1)
      expect(captureUnexpectedState).not.toHaveBeenCalled()
    })

    it('stops and reports after a rapid reconnect loop', async () => {
      // every connection appears instantaneous, so each is counted as a failed
      // (sub-healthy) attempt by the hot-loop guard
      jest.spyOn(Date, 'now').mockReturnValue(1000)

      streamChannelEvents.mockImplementation(async function* () {
        throw new TypeError('terminated')

        // eslint-disable-next-line no-unreachable
        yield undefined
      })

      const received = []

      for await (const event of streamConversationMonitorEvents(
        'user-1',
        'conv-1'
      )) {
        received.push(event)
      }

      expect(received).toHaveLength(0)
      // 5 throttled reconnects, then the 6th trips the guard and bails out
      expect(streamChannelEvents).toHaveBeenCalledTimes(6)
      expect(sleep).toHaveBeenCalledTimes(5)
      expect(captureUnexpectedState).toHaveBeenCalledWith(
        'Conversation monitor subscribe reconnect loop',
        { conversationId: 'conv-1', rapidReconnects: 6 }
      )
    })
  })

  describe('createConversationMonitorSink', () => {
    it('publishes monitored events with channel history options', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(123456)
      publishChannelMessage.mockResolvedValue(undefined)

      const sink = createConversationMonitorSink({
        userId: 'user-1',
        conversationId: 'conv-1',
      })

      const event = await sink.push('message', { type: 'bot', text: 'hi' })

      expect(event).toEqual({
        type: 'message',
        data: { type: 'bot', text: 'hi' },
        createdAt: 123456,
      })

      expect(publishChannelMessage).toHaveBeenCalledWith(
        'user-1',
        'conversation[conv-1]:monitor',
        event,
        {
          historyLength: CONVERSATION_MONITOR_CHANNEL_HISTORY_LENGTH,
          historyExpireSeconds:
            CONVERSATION_MONITOR_CHANNEL_HISTORY_EXPIRE_SECONDS,
        }
      )
    })

    it('does not publish unmonitored events', async () => {
      const sink = createConversationMonitorSink({
        userId: 'user-1',
        conversationId: 'conv-1',
      })

      const event = await sink.push('token', { token: 'x' })

      expect(event.type).toBe('token')
      expect(publishChannelMessage).not.toHaveBeenCalled()
    })

    it('captures publish failures without throwing from sink.push', async () => {
      const error = new Error('publish-failed')

      publishChannelMessage.mockRejectedValue(error)

      const sink = createConversationMonitorSink({
        userId: 'user-1',
        conversationId: 'conv-1',
      })

      await expect(
        sink.push('operationBegin', { id: 'op1', action: { id: 'a1' } })
      ).resolves.toMatchObject({ type: 'operationBegin' })

      await Promise.resolve()

      expect(captureError).toHaveBeenCalledWith(error)
    })
  })
})

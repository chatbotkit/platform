/**
 * @jest-environment node
 */

// @note the global `jest` on purpose: importing it from @jest/globals defeats
// babel's jest.mock hoisting under this transform, and the factories below
// silently stop applying.

import {
  DEFAULT_HISTORY_EXPIRE_SECONDS,
  publishChannelMessage,
  streamChannelEvents,
  waitForChannelMessage,
} from '@/lib/channel.core'
import { SystemError } from '@/lib/error'
import memcache from '@/lib/memcache'

// @note the channel layer's transport is the key-value module's pub/sub -
// these tests mock the module and drive the handler callbacks directly. The
// wire itself (Redis connections, SSE streams) is tested where it lives, in
// the backend suites of @chatbotkit-dev/memcache.

jest.mock('@/lib/fetch', () => {
  const mockFetch = jest.fn()

  mockFetch.AbortError = class AbortError extends Error {
    constructor(message) {
      super(message)
      this.name = 'AbortError'
    }
  }

  mockFetch.ABORT_ERROR_NAME = 'AbortError'

  mockFetch.anySignal = jest.fn((signals) => {
    const validSignals = signals.filter(Boolean)

    return validSignals.length > 0
      ? validSignals[0]
      : new AbortController().signal
  })

  return mockFetch
})

jest.mock('@/lib/memcache', () => {
  const mock = {
    xadd: jest.fn(),
    xrange: jest.fn(),
    xrevrange: jest.fn(),
    expire: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
  }

  return { __esModule: true, default: mock, ...mock }
})

// @note helpers to build the namespaced keys the channel layer uses
const streamKey = (channel) => `channel:stream:${channel}`
const historyKey = (channel) => `channel:history:${channel}`

/**
 * Wires the subscribe mock to capture the caller's handlers, so a test can
 * deliver messages and close events as the backend would.
 */
function mockSubscription() {
  const state = { subscriptions: [] }

  memcache.subscribe.mockImplementation(async (channel, handlers) => {
    const subscription = {
      channel,
      handlers,
      unsubscribe: jest.fn().mockResolvedValue(undefined),
    }

    state.subscriptions.push(subscription)

    return { unsubscribe: subscription.unsubscribe }
  })

  return state
}

const message = (data) => JSON.stringify({ _sm: data })

describe('channel', () => {
  beforeEach(() => {
    jest.resetAllMocks()

    memcache.xadd.mockClear()
    memcache.xrange.mockClear()
    memcache.xrevrange.mockClear()
    memcache.expire.mockClear()
    memcache.publish.mockClear()
    memcache.subscribe.mockClear()
  })

  describe('streamChannelEvents', () => {
    it('yields the subscribe event once the subscription is active, then messages', async () => {
      const state = mockSubscription()

      const iterator = streamChannelEvents('test-channel')

      const first = await iterator.next()

      expect(first.value).toEqual({
        type: 'subscribe',
        channel: streamKey('test-channel'),
      })

      expect(memcache.subscribe).toHaveBeenCalledWith(
        streamKey('test-channel'),
        expect.objectContaining({
          onMessage: expect.any(Function),
          onClose: expect.any(Function),
        })
      )

      state.subscriptions[0].handlers.onMessage(message({ text: 'hello' }))

      const second = await iterator.next()

      expect(second.value).toEqual({
        type: 'message',
        channel: streamKey('test-channel'),
        data: { text: 'hello' },
      })

      await iterator.return()

      expect(state.subscriptions[0].unsubscribe).toHaveBeenCalled()
    })

    it('skips messages that do not parse as stream messages', async () => {
      const state = mockSubscription()

      const iterator = streamChannelEvents('test-channel')

      await iterator.next() // subscribe event

      state.subscriptions[0].handlers.onMessage('not a stream message')
      state.subscriptions[0].handlers.onMessage(message({ ok: true }))

      const next = await iterator.next()

      expect(next.value).toEqual({
        type: 'message',
        channel: streamKey('test-channel'),
        data: { ok: true },
      })

      await iterator.return()
    })

    it('throws an abort error when the signal aborts mid-stream', async () => {
      const state = mockSubscription()

      const abortController = new AbortController()

      const iterator = streamChannelEvents('test-channel', {
        abortSignal: abortController.signal,
      })

      await iterator.next() // subscribe event

      const pending = iterator.next()

      abortController.abort()

      await expect(pending).rejects.toThrow('channel stream aborted')

      expect(state.subscriptions[0].unsubscribe).toHaveBeenCalled()
    })

    it('throws an abort error without subscribing when the signal is already aborted', async () => {
      mockSubscription()

      const abortController = new AbortController()

      abortController.abort()

      const iterator = streamChannelEvents('test-channel', {
        abortSignal: abortController.signal,
      })

      await expect(iterator.next()).rejects.toThrow('channel stream aborted')

      expect(memcache.subscribe).not.toHaveBeenCalled()
    })

    it('ends when the subscription closes cleanly', async () => {
      const state = mockSubscription()

      const iterator = streamChannelEvents('test-channel')

      await iterator.next() // subscribe event

      const pending = iterator.next()

      state.subscriptions[0].handlers.onClose()

      const result = await pending

      expect(result.done).toBe(true)
    })

    it('throws when the subscription closes with an error', async () => {
      const state = mockSubscription()

      const iterator = streamChannelEvents('test-channel')

      await iterator.next() // subscribe event

      const pending = iterator.next()

      state.subscriptions[0].handlers.onClose(new Error('connection lost'))

      await expect(pending).rejects.toThrow('connection lost')
    })

    it('replays history from the stream when historyLength is provided', async () => {
      const state = mockSubscription()

      // @note xrevrange returns newest first; the generator re-reverses into
      // chronological order

      memcache.xrevrange.mockResolvedValue({
        '2-1': { _hm: { text: 'second' } },
        '1-1': { _hm: { text: 'first' } },
      })

      const iterator = streamChannelEvents('test-channel', {
        historyLength: 10,
      })

      const first = await iterator.next()
      const second = await iterator.next()
      const third = await iterator.next()

      expect(memcache.xrevrange).toHaveBeenCalledWith(
        historyKey('test-channel'),
        '+',
        '-',
        10
      )

      expect(first.value).toEqual({
        type: 'message',
        channel: 'test-channel',
        data: { text: 'first' },
      })

      expect(second.value).toEqual({
        type: 'message',
        channel: 'test-channel',
        data: { text: 'second' },
      })

      expect(third.value).toEqual({
        type: 'subscribe',
        channel: streamKey('test-channel'),
      })

      await iterator.return()

      expect(state.subscriptions[0].unsubscribe).toHaveBeenCalled()
    })

    it('continues without history when the stream does not exist', async () => {
      mockSubscription()

      memcache.xrevrange.mockRejectedValue(new Error('no such stream'))

      const iterator = streamChannelEvents('test-channel', {
        historyLength: 10,
      })

      const first = await iterator.next()

      expect(first.value).toEqual({
        type: 'subscribe',
        channel: streamKey('test-channel'),
      })

      await iterator.return()
    })

    it('does not fetch history when historyLength is 0', async () => {
      mockSubscription()

      const iterator = streamChannelEvents('test-channel', {
        historyLength: 0,
      })

      await iterator.next()

      expect(memcache.xrevrange).not.toHaveBeenCalled()

      await iterator.return()
    })

    it('does not fetch history when historyLength is not provided', async () => {
      mockSubscription()

      const iterator = streamChannelEvents('test-channel')

      await iterator.next()

      expect(memcache.xrevrange).not.toHaveBeenCalled()

      await iterator.return()
    })
  })

  describe('waitForChannelMessage', () => {
    it('returns the first message received', async () => {
      const state = mockSubscription()

      const pending = waitForChannelMessage('test-channel')

      // @note wait for the subscription to be established before delivering

      await new Promise((resolve) => setTimeout(resolve, 0))

      state.subscriptions[0].handlers.onMessage(message({ answer: 42 }))

      await expect(pending).resolves.toEqual({ answer: 42 })

      expect(state.subscriptions[0].unsubscribe).toHaveBeenCalled()
    })

    it('calls onSubscribe when the subscription becomes active', async () => {
      const state = mockSubscription()

      const onSubscribe = jest.fn()

      const pending = waitForChannelMessage('test-channel', { onSubscribe })

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(onSubscribe).toHaveBeenCalled()

      state.subscriptions[0].handlers.onMessage(message({ done: true }))

      await pending
    })

    it('throws the aborted error when the wait is aborted', async () => {
      const state = mockSubscription()

      const abortController = new AbortController()

      const pending = waitForChannelMessage('test-channel', {
        abortSignal: abortController.signal,
      })

      await new Promise((resolve) => setTimeout(resolve, 0))

      abortController.abort()

      state.subscriptions[0].handlers.onClose()

      await expect(pending).rejects.toThrow(SystemError)
      await expect(pending).rejects.toThrow(
        'No message received: channel wait was aborted'
      )
    })

    it('retries when the stream ends and throws once maxDepth is exhausted', async () => {
      const state = mockSubscription()

      const pending = waitForChannelMessage('test-channel', { maxDepth: 1 })

      await new Promise((resolve) => setTimeout(resolve, 0))

      state.subscriptions[0].handlers.onClose()

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(state.subscriptions.length).toBe(2)

      state.subscriptions[1].handlers.onClose()

      await expect(pending).rejects.toThrow('No message received')
    })

    it('resolves on a message delivered after a retry', async () => {
      const state = mockSubscription()

      const pending = waitForChannelMessage('test-channel', { maxDepth: 2 })

      await new Promise((resolve) => setTimeout(resolve, 0))

      state.subscriptions[0].handlers.onClose()

      await new Promise((resolve) => setTimeout(resolve, 0))

      state.subscriptions[1].handlers.onMessage(message({ retried: true }))

      await expect(pending).resolves.toEqual({ retried: true })
    })
  })

  describe('publishChannelMessage', () => {
    it('publishes the message on the channel stream key', async () => {
      memcache.publish.mockResolvedValue(1)

      await publishChannelMessage('test-channel', { text: 'hello' })

      expect(memcache.publish).toHaveBeenCalledWith(
        streamKey('test-channel'),
        JSON.stringify({ _sm: { text: 'hello' } })
      )

      expect(memcache.xadd).not.toHaveBeenCalled()
    })

    it('stores history with trimming and the default expiry when historyLength is set', async () => {
      memcache.publish.mockResolvedValue(1)
      memcache.xadd.mockResolvedValue('1-1')
      memcache.expire.mockResolvedValue(1)

      await publishChannelMessage(
        'test-channel',
        { text: 'hello' },
        { historyLength: 25 }
      )

      expect(memcache.xadd).toHaveBeenCalledWith(
        historyKey('test-channel'),
        '*',
        { _hm: { text: 'hello' } },
        {
          trim: {
            type: 'MAXLEN',
            threshold: 25,
            comparison: '~',
          },
        }
      )

      expect(memcache.expire).toHaveBeenCalledWith(
        historyKey('test-channel'),
        DEFAULT_HISTORY_EXPIRE_SECONDS
      )

      expect(memcache.publish).toHaveBeenCalled()
    })

    it('honours a custom history expiry', async () => {
      memcache.publish.mockResolvedValue(1)
      memcache.xadd.mockResolvedValue('1-1')
      memcache.expire.mockResolvedValue(1)

      await publishChannelMessage(
        'test-channel',
        { text: 'hello' },
        { historyLength: 5, historyExpireSeconds: 120 }
      )

      expect(memcache.expire).toHaveBeenCalledWith(
        historyKey('test-channel'),
        120
      )
    })
  })
})

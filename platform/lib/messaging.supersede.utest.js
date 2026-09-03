import { publishChannelMessage } from '@/lib/channel.session'
import memcache from '@/lib/memcache'
import { allocateOrder, messagingSupersede } from '@/lib/messaging.supersede'

// @ts-nocheck

// @note shared mutable mock state (mock-prefixed so jest's factory scope rule
// allows referencing it). Reset in beforeEach.
let mockRedisStore = {}
let mockStreamEvents = []

jest.mock('@/lib/memcache', () => ({
  get: jest.fn(async (k) => (k in mockRedisStore ? mockRedisStore[k] : null)),
  set: jest.fn(async (k, v) => {
    mockRedisStore[k] = v
  }),
  incr: jest.fn(async (k) => {
    mockRedisStore[k] = (Number(mockRedisStore[k]) || 0) + 1

    return mockRedisStore[k]
  }),
  expire: jest.fn(async () => undefined),
}))

jest.mock('@/lib/channel.session', () => ({
  publishChannelMessage: jest.fn(async () => undefined),
  // @note replay the configured events, then idle until aborted - mimicking a
  // live subscription that does not end on its own.
  streamChannelEvents: jest.fn(async function* (_session, _channelId, options) {
    for (const event of mockStreamEvents) {
      if (options?.abortSignal?.aborted) {
        return
      }

      yield event
    }

    await new Promise((resolve) => {
      if (!options?.abortSignal || options.abortSignal.aborted) {
        resolve()

        return
      }

      options.abortSignal.addEventListener('abort', resolve, { once: true })
    })
  }),
}))

// @note drain the microtask/macrotask queue so the async watch loop processes
// the mocked events before we assert.
const flush = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve))
  }
}

beforeEach(() => {
  mockRedisStore = {}
  mockStreamEvents = []

  jest.clearAllMocks()
})

describe('allocateOrder', () => {
  test('increments a per-session counter and returns it', async () => {
    expect(await allocateOrder('sess-a')).toBe(1)
    expect(await allocateOrder('sess-a')).toBe(2)
    expect(await allocateOrder('sess-a')).toBe(3)

    expect(memcache.expire).toHaveBeenCalledWith(
      'sess-a-latest',
      expect.any(Number)
    )
  })

  test('counters are independent per session', async () => {
    await allocateOrder('sess-a')
    await allocateOrder('sess-a')

    expect(await allocateOrder('sess-b')).toBe(1)
  })

  test('publishes a nudge carrying the allocated order', async () => {
    await allocateOrder('sess-a')

    expect(publishChannelMessage).toHaveBeenCalledWith(
      { id: 'sess-a' },
      'inbound',
      {
        order: 1,
      }
    )
  })
})

describe('isSuperseded', () => {
  test('false for the latest message', async () => {
    await allocateOrder('sess-a') // marker → 1

    expect(await messagingSupersede('sess-a', 1).isSuperseded()).toBe(false)
  })

  test('true once a newer message is recorded', async () => {
    await allocateOrder('sess-a') // order 1
    await allocateOrder('sess-a') // order 2, marker → 2

    expect(await messagingSupersede('sess-a', 1).isSuperseded()).toBe(true)
  })

  test('false when the marker is absent', async () => {
    expect(await messagingSupersede('sess-a', 5).isSuperseded()).toBe(false)
  })
})

describe('record (native order)', () => {
  test('sets the marker and publishes a nudge', async () => {
    await messagingSupersede('sess-a', 42).record()

    expect(memcache.set).toHaveBeenCalledWith('sess-a-latest', 42, {
      ex: expect.any(Number),
    })

    expect(publishChannelMessage).toHaveBeenCalledWith(
      { id: 'sess-a' },
      'inbound',
      {
        order: 42,
      }
    )
  })

  test('isSuperseded reads what record wrote', async () => {
    await messagingSupersede('sess-a', 10).record()

    expect(await messagingSupersede('sess-a', 10).isSuperseded()).toBe(false)
    expect(await messagingSupersede('sess-a', 9).isSuperseded()).toBe(true)
  })
})

describe('watch (mid-turn soft-yield)', () => {
  test('yields when a newer message nudges', async () => {
    mockStreamEvents = [{ type: 'message', data: { order: 5 } }]

    const watch = messagingSupersede('sess-a', 3).watch()

    await flush()

    expect(watch.didYield()).toBe(true)
    expect(watch.yieldSignal.aborted).toBe(true)

    await watch.dispose()
  })

  test('ignores its own redelivery (same order) and older nudges', async () => {
    mockStreamEvents = [
      { type: 'message', data: { order: 3 } },
      { type: 'message', data: { order: 2 } },
    ]

    const watch = messagingSupersede('sess-a', 3).watch()

    await flush()

    expect(watch.didYield()).toBe(false)

    await watch.dispose()
  })

  test('ignores non-message (subscribe) events', async () => {
    mockStreamEvents = [
      { type: 'subscribe' },
      { type: 'message', data: { order: 9 } },
    ]

    const watch = messagingSupersede('sess-a', 3).watch()

    await flush()

    expect(watch.didYield()).toBe(true)

    await watch.dispose()
  })

  test('dispose resolves cleanly when no newer message arrives', async () => {
    const watch = messagingSupersede('sess-a', 3).watch()

    await flush()

    expect(watch.didYield()).toBe(false)

    await watch.dispose()

    expect(watch.didYield()).toBe(false)
  })
})

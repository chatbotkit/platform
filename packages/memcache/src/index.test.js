// @note the ESM jest preset provides no `jest` global. See packages/AGENTS.md.
import { jest } from '@jest/globals'

import memcache, {
  del,
  expire,
  get,
  getdel,
  hdel,
  hgetall,
  incr,
  incrementInWindow,
  lpop,
  lpush,
  lrange,
  pipeline,
  reset,
  rpop,
  rpush,
  sadd,
  scan,
  set,
  setFieldWithExpiry,
  setex,
  slidingWindow,
  smembers,
  srem,
  ttl,
  xadd,
  xrevrange,
  zadd,
  zrange,
  zrem,
} from './index'
import { publish, subscribe } from './index'

// @note this suite exercises the in-process backend through the selecting
// index, so an ambient REDIS_URL from the developer's shell must not flip it
// onto the Redis backend - that backend has its own suite in redis.test.js.
delete process.env.REDIS_URL

beforeEach(() => {
  reset()
})

describe('serialization parity with @upstash/redis', () => {
  // @note these are the cases where "just store the value" and "store what the
  // wire would have stored" disagree. Platform code depends on the second, so
  // they are asserted rather than left to the implementation's discretion.

  it('returns an object, not the reference it was given', async () => {
    const value = { nested: { count: 1 } }

    await set('key', value)

    const read = await get('key')

    expect(read).toEqual(value)
    expect(read).not.toBe(value)

    read.nested.count = 99

    expect(await get('key')).toEqual({ nested: { count: 1 } })
  })

  it('reads a stored numeric string back as a number', async () => {
    await set('key', '1')

    expect(await get('key')).toBe(1)
  })

  it('reads a stored non-numeric string back as a string', async () => {
    await set('key', 'hello')

    expect(await get('key')).toBe('hello')
  })

  it('reads an already-stringified object back as an object', async () => {
    // @note `lib/mcp.oauth.ts` stringifies on the way in and does not parse on
    // the way out, because the client parses for it.

    await set('key', JSON.stringify({ clientId: 'abc' }))

    expect(await get('key')).toEqual({ clientId: 'abc' })
  })

  it('does not corrupt a value that parses as a lossy number', async () => {
    await set('key', '007')

    expect(await get('key')).toBe('007')
  })

  it('preserves an integer wider than a double', async () => {
    await set('key', '9007199254740993')

    expect(await get('key')).toBe('9007199254740993')
  })

  it('round trips booleans and numbers', async () => {
    await set('bool', true)
    await set('num', 42)

    expect(await get('bool')).toBe(true)
    expect(await get('num')).toBe(42)
  })

  it('returns null for a missing key', async () => {
    expect(await get('nope')).toBeNull()
  })
})

describe('expiry', () => {
  it('expires a key once its ttl has passed', async () => {
    await set('key', 'value', { ex: 60 })

    expect(await get('key')).toBe('value')

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000)

    expect(await get('key')).toBeNull()

    Date.now.mockRestore()
  })

  it('reports -2 for a missing key and -1 for one with no expiry', async () => {
    expect(await ttl('missing')).toBe(-2)

    await set('key', 'value')

    expect(await ttl('key')).toBe(-1)
  })

  it('reports the remaining seconds', async () => {
    await setex('key', 30, 'value')

    expect(await ttl('key')).toBeGreaterThan(28)
    expect(await ttl('key')).toBeLessThanOrEqual(30)
  })

  it('applies an expiry to an existing key and reports whether it existed', async () => {
    await set('key', 'value')

    expect(await expire('key', 10)).toBe(1)
    expect(await expire('missing', 10)).toBe(0)
  })

  it('honours px as milliseconds', async () => {
    await set('key', 'value', { px: 50 })

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 51)

    expect(await get('key')).toBeNull()

    Date.now.mockRestore()
  })
})

describe('set options', () => {
  it('refuses to overwrite with nx', async () => {
    await set('key', 'first')

    expect(await set('key', 'second', { nx: true })).toBeNull()
    expect(await get('key')).toBe('first')
  })

  it('refuses to create with xx', async () => {
    expect(await set('key', 'value', { xx: true })).toBeNull()
    expect(await get('key')).toBeNull()
  })
})

describe('deletion', () => {
  it('counts only the keys that existed', async () => {
    await set('a', 1)
    await set('b', 2)

    expect(await del('a', 'b', 'c')).toBe(2)
  })

  it('reads and removes with getdel', async () => {
    await set('key', 'value')

    expect(await getdel('key')).toBe('value')
    expect(await get('key')).toBeNull()
  })
})

describe('incr', () => {
  it('starts at one and preserves an existing expiry', async () => {
    expect(await incr('counter')).toBe(1)

    await expire('counter', 60)

    expect(await incr('counter')).toBe(2)
    expect(await ttl('counter')).toBeGreaterThan(0)
  })
})

describe('hashes', () => {
  it('writes a field with an expiry and reads it back parsed', async () => {
    await setFieldWithExpiry('tools', 'source-a', [{ name: 'one' }], 3600)

    expect(await hgetall('tools')).toEqual({ 'source-a': [{ name: 'one' }] })
    expect(await ttl('tools')).toBeGreaterThan(0)
  })

  it('does not clobber a concurrent write to another field', async () => {
    await setFieldWithExpiry('tools', 'source-a', ['a'], 3600)
    await setFieldWithExpiry('tools', 'source-b', ['b'], 3600)

    expect(await hgetall('tools')).toEqual({
      'source-a': ['a'],
      'source-b': ['b'],
    })
  })

  it('returns null rather than an empty object once emptied', async () => {
    await setFieldWithExpiry('tools', 'only', ['x'], 3600)

    expect(await hdel('tools', 'only')).toBe(1)
    expect(await hgetall('tools')).toBeNull()
  })
})

describe('sets', () => {
  it('adds, reads and removes members without duplicating', async () => {
    expect(await sadd('bots', 'a', 'b')).toBe(2)
    expect(await sadd('bots', 'a')).toBe(0)

    expect((await smembers('bots')).sort()).toEqual(['a', 'b'])

    expect(await srem('bots', 'a')).toBe(1)
    expect(await smembers('bots')).toEqual(['b'])
  })

  it('returns an empty list for a missing set', async () => {
    expect(await smembers('missing')).toEqual([])
  })
})

describe('sorted sets', () => {
  it('reads members by score', async () => {
    await zadd('idle', { score: 100, member: 'a' })
    await zadd('idle', { score: 200, member: 'b' })
    await zadd('idle', { score: 300, member: 'c' })

    expect(await zrange('idle', 0, 200, { byScore: true })).toEqual(['a', 'b'])
  })

  it('reads members by rank when byScore is not set', async () => {
    await zadd('idle', { score: 300, member: 'c' })
    await zadd('idle', { score: 100, member: 'a' })

    expect(await zrange('idle', 0, -1)).toEqual(['a', 'c'])
  })

  it('updates the score of an existing member without adding it twice', async () => {
    expect(await zadd('idle', { score: 100, member: 'a' })).toBe(1)
    expect(await zadd('idle', { score: 500, member: 'a' })).toBe(0)

    expect(await zrange('idle', 0, 200, { byScore: true })).toEqual([])
    expect(await zrange('idle', 0, 600, { byScore: true })).toEqual(['a'])
  })

  it('removes members', async () => {
    await zadd('idle', { score: 100, member: 'a' })

    expect(await zrem('idle', 'a')).toBe(1)
    expect(await zrange('idle', 0, -1)).toEqual([])
  })
})

describe('lists', () => {
  it('pushes and pops from both ends', async () => {
    await rpush('list', 'a')
    await rpush('list', 'b')
    await lpush('list', 'z')

    expect(await lrange('list', 0, -1)).toEqual(['z', 'a', 'b'])

    expect(await lpop('list')).toBe('z')
    expect(await rpop('list')).toBe('b')
  })

  it('reports the length after pushing', async () => {
    expect(await rpush('list', 'a')).toBe(1)
    expect(await rpush('list', 'b')).toBe(2)
  })

  it('returns null when popping an empty or missing list', async () => {
    expect(await lpop('missing')).toBeNull()
  })

  it('round trips objects', async () => {
    await rpush('list', { task: 'one' })

    expect(await lrange('list', 0, -1)).toEqual([{ task: 'one' }])
  })
})

describe('streams', () => {
  it('reads entries newest first with xrevrange', async () => {
    await xadd('history', '*', { text: 'first' })
    await xadd('history', '*', { text: 'second' })

    const result = await xrevrange('history', '+', '-', 10)

    expect(Object.values(result)).toEqual([{ text: 'second' }, { text: 'first' }])
  })

  it('mints strictly increasing ids within the same millisecond', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000)

    const first = await xadd('history', '*', { text: 'a' })
    const second = await xadd('history', '*', { text: 'b' })

    Date.now.mockRestore()

    expect(first).not.toEqual(second)
  })

  it('trims to maxlen', async () => {
    for (const text of ['a', 'b', 'c', 'd']) {
      await xadd('history', '*', { text }, { trim: { type: 'MAXLEN', threshold: 2 } })
    }

    expect(Object.keys(await xrevrange('history', '+', '-'))).toHaveLength(2)
  })

  it('limits results by count', async () => {
    await xadd('history', '*', { text: 'a' })
    await xadd('history', '*', { text: 'b' })
    await xadd('history', '*', { text: 'c' })

    expect(Object.keys(await xrevrange('history', '+', '-', 2))).toHaveLength(2)
  })
})

describe('scan', () => {
  it('matches a glob and reports a complete cursor', async () => {
    await set('cache:user:1', 'a')
    await set('cache:user:2', 'b')
    await set('other:1', 'c')

    const [cursor, keys] = await scan(0, { match: 'cache:user:*' })

    expect(cursor).toBe('0')
    expect(keys.sort()).toEqual(['cache:user:1', 'cache:user:2'])
  })

  it('does not treat a literal dot as a wildcard', async () => {
    await set('a.b', '1')
    await set('axb', '2')

    const [, keys] = await scan(0, { match: 'a.b' })

    expect(keys).toEqual(['a.b'])
  })

  it('skips keys that have expired', async () => {
    await set('gone', 'value', { ex: 10 })
    await set('here', 'value')

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 11_000)

    const [, keys] = await scan(0, { match: '*' })

    Date.now.mockRestore()

    expect(keys).toEqual(['here'])
  })
})

describe('pipeline', () => {
  it('returns results in the order the commands were chained', async () => {
    await set('a', 1)
    await setex('b', 60, 2)

    const results = await pipeline().get('a').get('b').ttl('b').exec()

    expect(results[0]).toBe(1)
    expect(results[1]).toBe(2)
    expect(results[2]).toBeGreaterThan(0)
  })

  it('deletes through the chain', async () => {
    await set('a', 1)

    await pipeline().del('a').exec()

    expect(await get('a')).toBeNull()
  })
})

describe('incrementInWindow', () => {
  it('starts the window at the given amount', async () => {
    expect(await incrementInWindow('counter', 5, 60)).toBe(5)
    expect(await ttl('counter')).toBeGreaterThan(0)
  })

  it('accumulates within the window', async () => {
    await incrementInWindow('counter', 5, 60)

    expect(await incrementInWindow('counter', 3, 60)).toBe(8)
  })

  it('does not slide the window forward on later increments', async () => {
    // @note this is the property the operation exists for. A window that were
    // extended on every increment would never close, and the limit built on it
    // would never fire.

    const start = Date.now()

    const clock = jest.spyOn(Date, 'now').mockReturnValue(start)

    await incrementInWindow('counter', 1, 60)

    clock.mockReturnValue(start + 30_000)

    await incrementInWindow('counter', 1, 60)

    const remaining = await ttl('counter')

    clock.mockRestore()

    expect(remaining).toBeLessThanOrEqual(30)
  })

  it('starts a fresh window once the previous one has closed', async () => {
    const start = Date.now()

    await incrementInWindow('counter', 4, 60)

    jest.spyOn(Date, 'now').mockReturnValue(start + 61_000)

    const value = await incrementInWindow('counter', 4, 60)

    Date.now.mockRestore()

    expect(value).toBe(4)
  })
})

describe('empty calls agree with the Upstash-backed implementation', () => {
  // @note these three disagreed until they were caught by writing the same
  // cases against both. This implementation created the container as a side
  // effect and the push variants answered with the length they already had;
  // the other returns 0 without sending a command, because its client types
  // these as `(key, member, ...members)` and an empty spread would forward
  // `undefined` as the first member.
  //
  // Nothing in the platform makes an empty call today - `lib/bot.block.ts`
  // guards its own - so the divergence would have sat there until the first
  // caller that did not, and then behaved differently per deployment.

  it('adds no members without creating the set', async () => {
    expect(await sadd('bots')).toBe(0)
    expect(await smembers('bots')).toEqual([])

    const [, keys] = await scan(0, { match: 'bots' })

    expect(keys).toEqual([])
  })

  it('pushes nothing without creating the list', async () => {
    expect(await lpush('list')).toBe(0)
    expect(await rpush('list')).toBe(0)

    const [, keys] = await scan(0, { match: 'list' })

    expect(keys).toEqual([])
  })

  it('answers 0 rather than the length it already had', async () => {
    await rpush('list', 'a', 'b', 'c')

    expect(await lpush('list')).toBe(0)
    expect(await rpush('list')).toBe(0)

    expect(await lrange('list', 0, -1)).toEqual(['a', 'b', 'c'])
  })

  it('removes nothing from a missing key', async () => {
    expect(await srem('bots', 'a')).toBe(0)
    expect(await zrem('idle', 'a')).toBe(0)
  })
})

describe('slidingWindow', () => {
  it('allows requests up to the limit and refuses the next', async () => {
    expect(await slidingWindow('key', 2, '60 s')).toEqual({ success: true })
    expect(await slidingWindow('key', 2, '60 s')).toEqual({ success: true })
    expect(await slidingWindow('key', 2, '60 s')).toEqual({ success: false })
  })

  it('counts each key separately', async () => {
    await slidingWindow('a', 1, '60 s')

    expect(await slidingWindow('a', 1, '60 s')).toEqual({ success: false })
    expect(await slidingWindow('b', 1, '60 s')).toEqual({ success: true })
  })

  it('lets the allowance recover once the window has passed', async () => {
    const start = Date.now()

    await slidingWindow('key', 1, '60 s')

    expect(await slidingWindow('key', 1, '60 s')).toEqual({ success: false })

    // @note two windows on, so neither the current nor the previous counter
    // carries anything over.

    jest.spyOn(Date, 'now').mockReturnValue(start + 121_000)

    const result = await slidingWindow('key', 1, '60 s')

    Date.now.mockRestore()

    expect(result).toEqual({ success: true })
  })

  it('carries the previous window forward rather than granting a fresh allowance', async () => {
    // @note the property that makes this a sliding window rather than a fixed
    // one. Spending the whole allowance at the very end of a window must not
    // buy a full fresh allowance a moment later - which is exactly what a fixed
    // window does, and why a burst straddling a boundary can get through twice
    // the limit.

    const windowStart = 60_000

    jest.spyOn(Date, 'now').mockReturnValue(windowStart + 59_000)

    await slidingWindow('key', 2, '60 s')
    await slidingWindow('key', 2, '60 s')

    Date.now.mockReturnValue(windowStart + 61_000)

    const granted = [
      await slidingWindow('key', 2, '60 s'),
      await slidingWindow('key', 2, '60 s'),
    ].filter(({ success }) => success).length

    Date.now.mockRestore()

    // @note the previous window is weighted by how much of the new one is left
    // to run, so a sliver of allowance is back - but not all of it.

    expect(granted).toBeLessThan(2)
  })

  it('accepts a window with or without a space', async () => {
    expect(await slidingWindow('a', 1, '60 s')).toEqual({ success: true })
    expect(await slidingWindow('b', 1, '60s')).toEqual({ success: true })
  })

  it('refuses a window it cannot parse, rather than guessing', async () => {
    await expect(slidingWindow('key', 1, 'soon')).rejects.toThrow(
      /not a window length/
    )
  })
})

describe('bounding', () => {
  it('evicts the least recently used entry once full', async () => {
    for (let index = 0; index < 10_000; index++) {
      await set(`key:${index}`, index)
    }

    // @note reading key:0 makes it the most recent, so the next write should
    // evict key:1 rather than key:0.

    await get('key:0')

    await set('key:overflow', 'value')

    expect(await get('key:0')).toBe(0)
    expect(await get('key:1')).toBeNull()
    expect(await get('key:overflow')).toBe('value')
  })
})

describe('pub/sub', () => {
  it('delivers a published message to a subscriber, decoupled from the publisher stack', async () => {
    const received = []

    const subscription = await subscribe('news', {
      onMessage: (message) => received.push(message),
    })

    const countPromise = publish('news', 'hello')

    // @note delivery is deferred a microtask, so the publisher's own
    // synchronous stack never runs subscriber code - observable only before
    // the first await, which flushes the microtask queue
    expect(received).toEqual([])

    expect(await countPromise).toBe(1)
    expect(received).toEqual(['hello'])

    await subscription.unsubscribe()

    expect(await publish('news', 'after')).toBe(0)
  })

  it('fans out to every subscriber and counts them', async () => {
    const a = []
    const b = []

    const subA = await subscribe('fan', { onMessage: (m) => a.push(m) })
    const subB = await subscribe('fan', { onMessage: (m) => b.push(m) })

    expect(await publish('fan', 'x')).toBe(2)

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(a).toEqual(['x'])
    expect(b).toEqual(['x'])

    await subA.unsubscribe()
    await subB.unsubscribe()
  })

  it('answers 0 for a channel with no subscribers', async () => {
    expect(await publish('empty', 'x')).toBe(0)
  })
})

describe('the provider object', () => {
  it('is frozen and exposes every contract method', async () => {
    expect(Object.isFrozen(memcache)).toBe(true)

    for (const name of [
      'get',
      'set',
      'setex',
      'getdel',
      'del',
      'incr',
      'ttl',
      'expire',
      'scan',
      'hgetall',
      'hdel',
      'sadd',
      'srem',
      'smembers',
      'zadd',
      'zrange',
      'zrem',
      'lpush',
      'rpush',
      'lpop',
      'rpop',
      'lrange',
      'xadd',
      'xrange',
      'xrevrange',
      'pipeline',
      'incrementInWindow',
      'setFieldWithExpiry',
      'slidingWindow',
      'assertConfigured',
    ]) {
      expect(typeof memcache[name]).toBe('function')
    }
  })

  it('resolves assertConfigured, because there is nothing to configure', async () => {
    await expect(memcache.assertConfigured()).resolves.toBeUndefined()
  })
})

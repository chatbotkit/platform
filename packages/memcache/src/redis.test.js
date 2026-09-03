// @note exercises the Redis backend against a real server, which is why the
// whole file gates on REDIS_URL: without a server there is nothing honest to
// test. CI and local runs get one from the docker compose at the repository
// root, or from any redis-server pointed at by REDIS_URL.
//
// The cases mirror the serialization and semantics assertions in
// index.test.js where those are backend-independent, plus the atomic
// operations that are Lua on this backend.

// @note the ESM jest preset provides no `jest` global in this package's config
import { jest } from '@jest/globals'

import { disconnect, memcache } from './redis'

import { randomUUID } from 'node:crypto'

const describeWithRedis = process.env.REDIS_URL ? describe : describe.skip

const prefix = `memcache-test:${randomUUID()}:`

const k = (name) => `${prefix}${name}`

describeWithRedis('the redis backend', () => {
  afterAll(async () => {
    const [, keys] = await memcache.scan(0, { match: `${prefix}*`, count: 1000 })

    if (keys.length > 0) {
      await memcache.del(...keys)
    }

    await disconnect()
  })

  describe('strings', () => {
    it('round trips an object as a value, not a reference', async () => {
      const original = { a: 1, nested: { b: [1, 2, 3] } }

      await memcache.set(k('obj'), original)

      const read = await memcache.get(k('obj'))

      expect(read).toEqual(original)
      expect(read).not.toBe(original)
    })

    it('reads a numeric string back as a number', async () => {
      await memcache.set(k('num'), '1')

      expect(await memcache.get(k('num'))).toBe(1)
    })

    it('reads a stringified value back as the value', async () => {
      await memcache.set(k('json'), JSON.stringify({ x: 1 }))

      expect(await memcache.get(k('json'))).toEqual({ x: 1 })
    })

    it('honours nx', async () => {
      await memcache.set(k('nx'), 'first')

      expect(await memcache.set(k('nx'), 'second', { nx: true })).toBeNull()
      expect(await memcache.get(k('nx'))).toBe('first')
    })

    it('sets an expiry with ex', async () => {
      await memcache.set(k('ex'), 'v', { ex: 60 })

      const remaining = await memcache.ttl(k('ex'))

      expect(remaining).toBeGreaterThan(0)
      expect(remaining).toBeLessThanOrEqual(60)
    })

    it('getdel reads and removes', async () => {
      await memcache.set(k('gd'), { once: true })

      expect(await memcache.getdel(k('gd'))).toEqual({ once: true })
      expect(await memcache.get(k('gd'))).toBeNull()
    })

    it('incr counts', async () => {
      expect(await memcache.incr(k('ctr'))).toBe(1)
      expect(await memcache.incr(k('ctr'))).toBe(2)
    })
  })

  describe('hashes', () => {
    it('answers null for a missing hash', async () => {
      expect(await memcache.hgetall(k('nohash'))).toBeNull()
    })

    it('setFieldWithExpiry writes a field and expires the hash', async () => {
      await memcache.setFieldWithExpiry(k('h'), 'field', { v: 1 }, 60)
      await memcache.setFieldWithExpiry(k('h'), 'other', 'plain', 60)

      expect(await memcache.hgetall(k('h'))).toEqual({
        field: { v: 1 },
        other: 'plain',
      })

      expect(await memcache.ttl(k('h'))).toBeGreaterThan(0)

      await memcache.hdel(k('h'), 'field')

      expect(await memcache.hgetall(k('h'))).toEqual({ other: 'plain' })
    })
  })

  describe('sets', () => {
    it('adds, lists and removes members through serialization', async () => {
      expect(await memcache.sadd(k('s'), { id: 1 }, { id: 2 })).toBe(2)
      expect(await memcache.sadd(k('s'), { id: 1 })).toBe(0)

      const members = await memcache.smembers(k('s'))

      expect(members).toHaveLength(2)
      expect(members).toEqual(
        expect.arrayContaining([{ id: 1 }, { id: 2 }])
      )

      expect(await memcache.srem(k('s'), { id: 1 })).toBe(1)
      expect(await memcache.sadd(k('s'))).toBe(0)
    })
  })

  describe('sorted sets', () => {
    it('ranges by rank, by score, and in reverse', async () => {
      await memcache.zadd(k('z'), { score: 1, member: 'a' })
      await memcache.zadd(k('z'), { score: 2, member: 'b' })
      await memcache.zadd(k('z'), { score: 3, member: 'c' })

      expect(await memcache.zrange(k('z'), 0, -1)).toEqual(['a', 'b', 'c'])

      expect(
        await memcache.zrange(k('z'), 2, 3, { byScore: true })
      ).toEqual(['b', 'c'])

      expect(
        await memcache.zrange(k('z'), 2, 3, { byScore: true, rev: true })
      ).toEqual(['c', 'b'])

      expect(await memcache.zrem(k('z'), 'b')).toBe(1)
    })
  })

  describe('lists', () => {
    it('pushes, ranges and pops through serialization', async () => {
      await memcache.rpush(k('l'), 'one', { two: 2 })
      await memcache.lpush(k('l'), 'zero')

      expect(await memcache.lrange(k('l'), 0, -1)).toEqual([
        'zero',
        'one',
        { two: 2 },
      ])

      expect(await memcache.lpop(k('l'))).toBe('zero')
      expect(await memcache.rpop(k('l'))).toEqual({ two: 2 })

      expect(await memcache.rpush(k('l'))).toBe(0)
    })
  })

  describe('streams', () => {
    it('adds, ranges, reverse-ranges and trims', async () => {
      await memcache.xadd(k('x'), '1-1', { event: 'first', payload: { n: 1 } })
      await memcache.xadd(k('x'), '2-1', { event: 'second' })
      await memcache.xadd(k('x'), '3-1', { event: 'third' })

      const forward = await memcache.xrange(k('x'), '-', '+')

      expect(Object.keys(forward)).toEqual(['1-1', '2-1', '3-1'])
      expect(forward['1-1']).toEqual({ event: 'first', payload: { n: 1 } })

      const backward = await memcache.xrevrange(k('x'), '+', '-', 2)

      expect(Object.keys(backward)).toEqual(['3-1', '2-1'])

      await memcache.xadd(
        k('x'),
        '4-1',
        { event: 'fourth' },
        { trim: { type: 'MAXLEN', threshold: 2, comparison: '=' } }
      )

      expect(Object.keys(await memcache.xrange(k('x'), '-', '+'))).toEqual([
        '3-1',
        '4-1',
      ])
    })
  })

  describe('scan', () => {
    it('finds keys by pattern across cursor pages', async () => {
      await memcache.set(k('scan:a'), 1)
      await memcache.set(k('scan:b'), 2)

      const found = []

      let cursor = '0'

      do {
        const [next, keys] = await memcache.scan(cursor, {
          match: `${prefix}scan:*`,
          count: 1,
        })

        cursor = next

        found.push(...keys)
      } while (cursor !== '0')

      expect(found.sort()).toEqual([k('scan:a'), k('scan:b')])
    })
  })

  describe('pipeline', () => {
    it('batches get, ttl and del and deserializes the gets', async () => {
      await memcache.set(k('p1'), { batched: true }, { ex: 60 })
      await memcache.set(k('p2'), 'gone')

      const [value, remaining, removed] = await memcache
        .pipeline()
        .get(k('p1'))
        .ttl(k('p1'))
        .del(k('p2'))
        .exec()

      expect(value).toEqual({ batched: true })
      expect(remaining).toBeGreaterThan(0)
      expect(removed).toBe(1)
      expect(await memcache.get(k('p2'))).toBeNull()
    })
  })

  describe('incrementInWindow', () => {
    it('starts a window and keeps counting inside it', async () => {
      expect(await memcache.incrementInWindow(k('w'), 5, 60)).toBe(5)
      expect(await memcache.incrementInWindow(k('w'), 3, 60)).toBe(8)

      expect(await memcache.ttl(k('w'))).toBeGreaterThan(0)
    })
  })

  describe('slidingWindow', () => {
    it('allows up to the limit and refuses the next', async () => {
      expect(await memcache.slidingWindow(k('rate'), 2, '10 s')).toEqual({
        success: true,
      })
      expect(await memcache.slidingWindow(k('rate'), 2, '10 s')).toEqual({
        success: true,
      })
      expect(await memcache.slidingWindow(k('rate'), 2, '10 s')).toEqual({
        success: false,
      })
    })

    it('counts each key separately', async () => {
      expect(await memcache.slidingWindow(k('rate2'), 1, '10s')).toEqual({
        success: true,
      })
    })
  })

  describe('pub/sub', () => {
    it('delivers messages across connections once the subscription resolves', async () => {
      const received = []

      const subscription = await memcache.subscribe(k('channel'), {
        onMessage: (message) => received.push(message),
      })

      const count = await memcache.publish(k('channel'), 'over the wire')

      expect(count).toBe(1)

      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(received).toEqual(['over the wire'])

      await subscription.unsubscribe()

      expect(await memcache.publish(k('channel'), 'after')).toBe(0)
    })

    it('keeps channels separate', async () => {
      const received = []

      const subscription = await memcache.subscribe(k('mine'), {
        onMessage: (message) => received.push(message),
      })

      await memcache.publish(k('other'), 'not for me')
      await memcache.publish(k('mine'), 'for me')

      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(received).toEqual(['for me'])

      await subscription.unsubscribe()
    })
  })

  describe('pub/sub close signalling', () => {
    it('fires onClose when the backend disconnects', async () => {
      const onClose = jest.fn()

      const subscription = await memcache.subscribe(k('closing'), {
        onMessage: () => {},
        onClose,
      })

      await disconnect()

      expect(onClose).toHaveBeenCalled()

      // @note unsubscribing after the fact is a harmless no-op
      await subscription.unsubscribe()
    })
  })

  describe('assertConfigured', () => {
    it('resolves when the server answers', async () => {
      await expect(memcache.assertConfigured()).resolves.toBeUndefined()
    })
  })
})

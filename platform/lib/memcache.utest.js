/**
 * @jest-environment node
 */
import installedMemcache from '@chatbotkit-dev/memcache'

import memcacheDefault, { memcache } from '@/lib/memcache'

// @note provider-specific client construction belongs to the installed
// memcache implementation and is tested there. What is left here is the only
// thing this module still does: hand every caller whichever implementation
// pnpm resolved, under both the names callers import it by.

describe('memcache', () => {
  it('is the installed key-value module', () => {
    expect(memcacheDefault).toBe(installedMemcache)
    expect(memcache).toBe(installedMemcache)
  })

  it('exposes the operations the platform calls', () => {
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
    ]) {
      expect(typeof memcache[name]).toBe('function')
    }
  })
})

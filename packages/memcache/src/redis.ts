// @note the Redis backend of the community key-value default.
//
// A standard-Redis (TCP) implementation of @chatbotkit-dev/memcache-spec over
// ioredis, selected by ./index.ts when REDIS_URL is set. It exists so that a
// self-hosted deployment scales past one process without installing a module
// override: the docker compose in the repository root stands up a Redis next
// to the application and points REDIS_URL at it.
//
// Values round trip through the same serialize/deserialize pair as the
// in-process backend, which is itself a port of what @upstash/redis does over
// the wire - so all three implementations of the contract agree on the
// surprising cases (see ./memory.ts for which cases those are and why).
//
// The client is loaded and connected lazily on first use, never at import.
// The platform must be importable and buildable without this deployment's
// services present, and ioredis is a TCP client that has no business in a
// bundle that never calls it.

import type {
  Duration,
  MemcachePipeline,
  MemcacheProvider,
  ScanOptions,
  SetOptions,
  SortedSetMember,
  XAddOptions,
  ZRangeOptions,
} from '@chatbotkit-dev/memcache-spec'

import { deserialize, serialize } from './memory'

import type { Redis } from 'ioredis'

export type * from '@chatbotkit-dev/memcache-spec'

let client: Redis | undefined

async function getClient(): Promise<Redis> {
  if (!client) {
    const url = process.env.REDIS_URL

    if (!url) {
      throw new Error(
        'REDIS_URL is not set, so the Redis key-value backend cannot connect. Set it to a redis:// url, or unset it to fall back to the in-process store.'
      )
    }

    const { default: RedisClient } = await import('ioredis')

    client = new RedisClient(url, {
      maxRetriesPerRequest: 3,
    })
  }

  return client
}

/**
 * @note test hook, mirroring `reset` on the in-process backend: disconnects
 * so the next call reconnects (and re-reads REDIS_URL).
 */
export async function disconnect(): Promise<void> {
  if (subscriber) {
    subscriber.disconnect()

    subscriber = undefined

    closeAllSubscriptions()
  }

  if (client) {
    client.disconnect()

    client = undefined
  }
}

export async function get<TData>(key: string): Promise<TData | null> {
  const c = await getClient()

  return deserialize<TData>(await c.get(key))
}

export async function set<TData>(
  key: string,
  value: TData,
  options?: SetOptions
): Promise<'OK' | TData | null> {
  const c = await getClient()

  const args: (string | number)[] = []

  if (options?.ex !== undefined) {
    args.push('EX', options.ex)
  }

  if (options?.px !== undefined) {
    args.push('PX', options.px)
  }

  if (options?.nx) {
    args.push('NX')
  }

  if (options?.xx) {
    args.push('XX')
  }

  const result = await c.call('set', key, serialize(value), ...args)

  return result as 'OK' | null
}

export async function setex<TData>(
  key: string,
  seconds: number,
  value: TData
): Promise<'OK'> {
  const c = await getClient()

  return (await c.setex(key, seconds, serialize(value))) as 'OK'
}

export async function getdel<TData>(key: string): Promise<TData | null> {
  const c = await getClient()

  return deserialize<TData>(await c.getdel(key))
}

export async function del(...keys: string[]): Promise<number> {
  if (keys.length === 0) {
    return 0
  }

  const c = await getClient()

  return c.del(...keys)
}

export async function incr(key: string): Promise<number> {
  const c = await getClient()

  return c.incr(key)
}

export async function ttl(key: string): Promise<number> {
  const c = await getClient()

  return c.ttl(key)
}

export async function expire(key: string, seconds: number): Promise<0 | 1> {
  const c = await getClient()

  return (await c.expire(key, seconds)) as 0 | 1
}

export async function scan(
  cursor: string | number,
  options?: ScanOptions
): Promise<[string, string[]]> {
  const c = await getClient()

  const args: (string | number)[] = []

  if (options?.match !== undefined) {
    args.push('MATCH', options.match)
  }

  if (options?.count !== undefined) {
    args.push('COUNT', options.count)
  }

  return (await c.call('scan', String(cursor), ...args)) as [string, string[]]
}

export async function hgetall<TData extends Record<string, unknown>>(
  key: string
): Promise<TData | null> {
  const c = await getClient()

  const raw = await c.hgetall(key)

  const fields = Object.keys(raw)

  // @note Redis answers a missing hash with an empty reply; the contract
  // (matching @upstash/redis) answers it with null.

  if (fields.length === 0) {
    return null
  }

  const result: Record<string, unknown> = {}

  for (const field of fields) {
    result[field] = deserialize(raw[field])
  }

  return result as TData
}

export async function hdel(key: string, ...fields: string[]): Promise<number> {
  if (fields.length === 0) {
    return 0
  }

  const c = await getClient()

  return c.hdel(key, ...fields)
}

export async function sadd<TData>(
  key: string,
  ...members: TData[]
): Promise<number> {
  if (members.length === 0) {
    return 0
  }

  const c = await getClient()

  return c.sadd(key, ...members.map((member) => serialize(member)))
}

export async function srem<TData>(
  key: string,
  ...members: TData[]
): Promise<number> {
  if (members.length === 0) {
    return 0
  }

  const c = await getClient()

  return c.srem(key, ...members.map((member) => serialize(member)))
}

export async function smembers<TData extends unknown[] = string[]>(
  key: string
): Promise<TData> {
  const c = await getClient()

  const raw = await c.smembers(key)

  return raw.map((member) => deserialize(member)) as TData
}

export async function zadd(
  key: string,
  member: SortedSetMember
): Promise<number | null> {
  const c = await getClient()

  return c.zadd(key, member.score, member.member)
}

export async function zrange<TData extends unknown[]>(
  key: string,
  min: number | string,
  max: number | string,
  options?: ZRangeOptions
): Promise<TData> {
  const c = await getClient()

  // @note with REV the bounds swap positions - `ZRANGE key max min BYSCORE
  // REV` - which is Redis's spelling, not ours; the contract keeps min and max
  // meaning what they say regardless of direction.

  const bounds =
    options?.rev && options?.byScore
      ? [String(max), String(min)]
      : [String(min), String(max)]

  const flags: string[] = []

  if (options?.byScore) {
    flags.push('BYSCORE')
  }

  if (options?.rev) {
    flags.push('REV')
  }

  const raw = (await c.call('zrange', key, ...bounds, ...flags)) as string[]

  return raw.map((member) => deserialize(member)) as TData
}

export async function zrem<TData>(
  key: string,
  ...members: TData[]
): Promise<number> {
  if (members.length === 0) {
    return 0
  }

  const c = await getClient()

  return c.zrem(key, ...members.map((member) => serialize(member)))
}

export async function lpush<TData>(
  key: string,
  ...elements: TData[]
): Promise<number> {
  if (elements.length === 0) {
    return 0
  }

  const c = await getClient()

  return c.lpush(key, ...elements.map((element) => serialize(element)))
}

export async function rpush<TData>(
  key: string,
  ...elements: TData[]
): Promise<number> {
  if (elements.length === 0) {
    return 0
  }

  const c = await getClient()

  return c.rpush(key, ...elements.map((element) => serialize(element)))
}

export async function lpop<TData>(key: string): Promise<TData | null> {
  const c = await getClient()

  return deserialize<TData>(await c.lpop(key))
}

export async function rpop<TData = string>(
  key: string
): Promise<TData | null> {
  const c = await getClient()

  return deserialize<TData>(await c.rpop(key))
}

export async function lrange<TResult = string>(
  key: string,
  start: number,
  stop: number
): Promise<TResult[]> {
  const c = await getClient()

  const raw = await c.lrange(key, start, stop)

  return raw.map((element) => deserialize(element) as TResult)
}

export async function xadd(
  key: string,
  id: string,
  data: Record<string, unknown>,
  options?: XAddOptions
): Promise<string | null> {
  const c = await getClient()

  const args: (string | number)[] = []

  if (options?.trim) {
    args.push(options.trim.type)

    if (options.trim.comparison) {
      args.push(options.trim.comparison)
    }

    args.push(String(options.trim.threshold))
  }

  args.push(id)

  for (const [field, value] of Object.entries(data)) {
    args.push(field, serialize(value))
  }

  return (await c.call('xadd', key, ...args)) as string | null
}

function toStreamResult(
  entries: [string, string[]][]
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {}

  for (const [id, flat] of entries) {
    const fields: Record<string, unknown> = {}

    for (let index = 0; index < flat.length; index += 2) {
      fields[flat[index]] = deserialize(flat[index + 1])
    }

    result[id] = fields
  }

  return result
}

export async function xrange(
  key: string,
  start: string,
  end: string,
  count?: number
): Promise<Record<string, Record<string, unknown>>> {
  const c = await getClient()

  const raw = (await (count === undefined
    ? c.call('xrange', key, start, end)
    : c.call('xrange', key, start, end, 'COUNT', count))) as [
    string,
    string[],
  ][]

  return toStreamResult(raw)
}

export async function xrevrange(
  key: string,
  end: string,
  start: string,
  count?: number
): Promise<Record<string, Record<string, unknown>>> {
  const c = await getClient()

  const raw = (await (count === undefined
    ? c.call('xrevrange', key, end, start)
    : c.call('xrevrange', key, end, start, 'COUNT', count))) as [
    string,
    string[],
  ][]

  return toStreamResult(raw)
}

export function pipeline(): MemcachePipeline {
  const commands: ['get' | 'del' | 'ttl', string[]][] = []

  const chain: MemcachePipeline = {
    get(key: string) {
      commands.push(['get', [key]])

      return chain
    },

    del(...keys: string[]) {
      commands.push(['del', keys])

      return chain
    },

    ttl(key: string) {
      commands.push(['ttl', [key]])

      return chain
    },

    async exec<TData = unknown[]>() {
      const c = await getClient()

      const batch = c.pipeline()

      for (const [command, args] of commands) {
        if (command === 'get') {
          batch.get(args[0])
        } else if (command === 'ttl') {
          batch.ttl(args[0])
        } else {
          batch.del(...args)
        }
      }

      const replies = (await batch.exec()) ?? []

      return replies.map(([error, value], index) => {
        if (error) {
          throw error
        }

        return commands[index][0] === 'get'
          ? deserialize(value as string | null)
          : value
      }) as TData
    },
  }

  return chain
}

// @note the same scripts the Upstash-backed implementation runs - see the
// contract in @chatbotkit-dev/memcache-spec for why these are operations
// rather than `eval`.

const INCREMENT_IN_WINDOW_SCRIPT = `
  if redis.call("exists", KEYS[1]) == 1 then
    return redis.call("incrby", KEYS[1], ARGV[1])
  else
    redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[2])
    return tonumber(ARGV[1])
  end
`

const SET_FIELD_AND_EXPIRE_SCRIPT = `
  redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
  return 1
`

// @note a sliding log: drop entries older than the window, count what is
// left, and admit the caller by recording a new entry only when the count is
// under the limit. Atomic for the same reason the other two scripts are - a
// check and a record in two round trips over-admits under concurrency.

const SLIDING_WINDOW_SCRIPT = `
  local now = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)
  if redis.call('ZCARD', KEYS[1]) < limit then
    redis.call('ZADD', KEYS[1], now, ARGV[4])
    redis.call('PEXPIRE', KEYS[1], window)
    return 1
  end
  return 0
`

export async function incrementInWindow(
  key: string,
  amount: number,
  windowInSeconds: number
): Promise<number> {
  const c = await getClient()

  const result = await c.eval(
    INCREMENT_IN_WINDOW_SCRIPT,
    1,
    key,
    String(amount),
    String(windowInSeconds)
  )

  return Number(result)
}

export async function setFieldWithExpiry(
  key: string,
  field: string,
  value: unknown,
  ttlInSeconds: number
): Promise<void> {
  const c = await getClient()

  await c.eval(
    SET_FIELD_AND_EXPIRE_SCRIPT,
    1,
    key,
    field,
    JSON.stringify(value),
    String(ttlInSeconds)
  )
}

const DURATION_UNITS_IN_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
}

function durationToMs(duration: Duration): number {
  const match = /^(\d+)\s?(ms|s|m|h|d)$/.exec(duration)

  if (!match) {
    throw new Error(`unparseable duration: ${duration}`)
  }

  return Number(match[1]) * DURATION_UNITS_IN_MS[match[2]]
}

let slidingWindowSequence = 0

export async function slidingWindow(
  key: string,
  tokens: number,
  window: Duration
): Promise<{ success: boolean }> {
  const c = await getClient()

  const now = Date.now()

  const result = await c.eval(
    SLIDING_WINDOW_SCRIPT,
    1,
    key,
    String(now),
    String(durationToMs(window)),
    String(tokens),
    `${now}-${slidingWindowSequence++}`
  )

  return { success: Number(result) === 1 }
}

// @note pub/sub over a dedicated subscriber connection. A Redis connection
// in subscribe mode can run nothing else, so the first subscription
// duplicates the main client and every channel shares that one subscriber;
// the last unsubscribe on a channel releases the channel, and disconnect()
// releases the connection.

type SubscribeHandlers = {
  onMessage: (message: string) => void
  onClose?: (error?: unknown) => void
}

let subscriber: Redis | undefined

const channelSubscribers = new Map<string, Set<SubscribeHandlers>>()

function closeAllSubscriptions(error?: unknown): void {
  const closing = [...channelSubscribers.values()]

  channelSubscribers.clear()

  for (const handlers of closing) {
    for (const handler of handlers) {
      handler.onClose?.(error)
    }
  }
}

async function getSubscriber(): Promise<Redis> {
  if (!subscriber) {
    const c = await getClient()

    subscriber = c.duplicate()

    subscriber.on('message', (channel: string, message: string) => {
      const handlers = channelSubscribers.get(channel)

      if (!handlers) {
        return
      }

      for (const handler of [...handlers]) {
        handler.onMessage(message)
      }
    })

    subscriber.on('end', () => {
      closeAllSubscriptions()
    })

    subscriber.on('error', () => {
      // @note ioredis retries on its own; 'end' is the terminal signal and
      // the one that closes subscriptions
    })
  }

  return subscriber
}

export async function publish(
  channel: string,
  message: string
): Promise<number> {
  const c = await getClient()

  return c.publish(channel, message)
}

export async function subscribe(
  channel: string,
  handlers: SubscribeHandlers
): Promise<{ unsubscribe(): Promise<void> }> {
  const sub = await getSubscriber()

  let channelHandlers = channelSubscribers.get(channel)

  if (!channelHandlers) {
    channelHandlers = new Set()

    channelSubscribers.set(channel, channelHandlers)
  }

  channelHandlers.add(handlers)

  if (channelHandlers.size === 1) {
    try {
      await sub.subscribe(channel)
    } catch (error) {
      channelHandlers.delete(handlers)

      if (!channelHandlers.size) {
        channelSubscribers.delete(channel)
      }

      throw error
    }
  }

  return {
    async unsubscribe() {
      const current = channelSubscribers.get(channel)

      if (!current) {
        return
      }

      current.delete(handlers)

      if (current.size === 0) {
        channelSubscribers.delete(channel)

        if (subscriber) {
          await subscriber.unsubscribe(channel).catch(() => {})
        }
      }
    },
  }
}

export async function assertConfigured(): Promise<void> {
  if (!process.env.REDIS_URL) {
    throw new Error(
      'REDIS_URL is not set, so the platform has no shared key-value store. Set it to a redis:// url, or unset it to fall back to the in-process default.'
    )
  }

  // @note a reachability check, not just a presence check - see the same
  // convention in every swappable module.

  try {
    const c = await getClient()

    await c.ping()
  } catch (error) {
    throw new Error(
      `REDIS_URL is set but the store did not answer a PING: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const memcache: MemcacheProvider = Object.freeze({
  get,
  set,
  setex,
  getdel,
  del,
  incr,
  ttl,
  expire,
  scan,
  hgetall,
  hdel,
  sadd,
  srem,
  smembers,
  zadd,
  zrange,
  zrem,
  lpush,
  rpush,
  lpop,
  rpop,
  lrange,
  xadd,
  xrange,
  xrevrange,
  publish,
  subscribe,
  pipeline,
  incrementInWindow,
  setFieldWithExpiry,
  slidingWindow,
  assertConfigured,
})

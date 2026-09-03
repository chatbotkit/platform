// @note the community key-value default.
//
// Two backends implement the contract in @chatbotkit-dev/memcache-spec, and
// this module picks between them per call:
//
// - with REDIS_URL set, the Redis backend in ./redis.ts - a shared store, so
//   rate limits, sessions and dedupe markers hold across processes and
//   restarts. The docker compose at the repository root stands one up.
// - without it, the in-process store in ./memory.ts, so the platform runs
//   with no key-value service configured at all.
//
// The selection is read on every call rather than once at import, for the
// same reason neither backend connects at import: the platform must be
// importable and buildable with no services configured, and tests flip the
// environment between cases.
//
// Deployments that outgrow both install their own module over
// @chatbotkit-dev/memcache with a pnpm override - see README.md.

import type {
  Duration,
  MemcachePipeline,
  MemcacheProvider,
  MemcacheSubscription,
  ScanOptions,
  SetOptions,
  SortedSetMember,
  XAddOptions,
  ZRangeOptions,
} from '@chatbotkit-dev/memcache-spec'

import { memcache as memoryMemcache } from './memory'
import { memcache as redisMemcache } from './redis'

export type * from '@chatbotkit-dev/memcache-spec'

export { reset } from './memory'

function backend(): MemcacheProvider {
  return process.env.REDIS_URL ? redisMemcache : memoryMemcache
}

export async function get<TData>(key: string): Promise<TData | null> {
  return backend().get<TData>(key)
}

export async function set<TData>(
  key: string,
  value: TData,
  options?: SetOptions
): Promise<'OK' | TData | null> {
  return backend().set<TData>(key, value, options)
}

export async function setex<TData>(
  key: string,
  seconds: number,
  value: TData
): Promise<'OK'> {
  return backend().setex<TData>(key, seconds, value)
}

export async function getdel<TData>(key: string): Promise<TData | null> {
  return backend().getdel<TData>(key)
}

export async function del(...keys: string[]): Promise<number> {
  return backend().del(...keys)
}

export async function incr(key: string): Promise<number> {
  return backend().incr(key)
}

export async function ttl(key: string): Promise<number> {
  return backend().ttl(key)
}

export async function expire(key: string, seconds: number): Promise<0 | 1> {
  return backend().expire(key, seconds)
}

export async function scan(
  cursor: string | number,
  options?: ScanOptions
): Promise<[string, string[]]> {
  return backend().scan(cursor, options)
}

export async function hgetall<TData extends Record<string, unknown>>(
  key: string
): Promise<TData | null> {
  return backend().hgetall<TData>(key)
}

export async function hdel(key: string, ...fields: string[]): Promise<number> {
  return backend().hdel(key, ...fields)
}

export async function sadd<TData>(
  key: string,
  ...members: TData[]
): Promise<number> {
  return backend().sadd<TData>(key, ...members)
}

export async function srem<TData>(
  key: string,
  ...members: TData[]
): Promise<number> {
  return backend().srem<TData>(key, ...members)
}

export async function smembers<TData extends unknown[] = string[]>(
  key: string
): Promise<TData> {
  return backend().smembers<TData>(key)
}

export async function zadd(
  key: string,
  member: SortedSetMember
): Promise<number | null> {
  return backend().zadd(key, member)
}

export async function zrange<TData extends unknown[]>(
  key: string,
  min: number | string,
  max: number | string,
  options?: ZRangeOptions
): Promise<TData> {
  return backend().zrange<TData>(key, min, max, options)
}

export async function zrem<TData>(
  key: string,
  ...members: TData[]
): Promise<number> {
  return backend().zrem<TData>(key, ...members)
}

export async function lpush<TData>(
  key: string,
  ...elements: TData[]
): Promise<number> {
  return backend().lpush<TData>(key, ...elements)
}

export async function rpush<TData>(
  key: string,
  ...elements: TData[]
): Promise<number> {
  return backend().rpush<TData>(key, ...elements)
}

export async function lpop<TData>(key: string): Promise<TData | null> {
  return backend().lpop<TData>(key)
}

export async function rpop<TData = string>(
  key: string
): Promise<TData | null> {
  return backend().rpop<TData>(key)
}

export async function lrange<TResult = string>(
  key: string,
  start: number,
  stop: number
): Promise<TResult[]> {
  return backend().lrange<TResult>(key, start, stop)
}

export async function xadd(
  key: string,
  id: string,
  data: Record<string, unknown>,
  options?: XAddOptions
): Promise<string | null> {
  return backend().xadd(key, id, data, options)
}

export async function xrange(
  key: string,
  start: string,
  end: string,
  count?: number
): Promise<Record<string, Record<string, unknown>>> {
  return backend().xrange(key, start, end, count)
}

export async function xrevrange(
  key: string,
  end: string,
  start: string,
  count?: number
): Promise<Record<string, Record<string, unknown>>> {
  return backend().xrevrange(key, end, start, count)
}

export async function publish(
  channel: string,
  message: string
): Promise<number> {
  return backend().publish(channel, message)
}

export async function subscribe(
  channel: string,
  handlers: {
    onMessage: (message: string) => void
    onClose?: (error?: unknown) => void
  }
): Promise<MemcacheSubscription> {
  return backend().subscribe(channel, handlers)
}

export function pipeline(): MemcachePipeline {
  return backend().pipeline()
}

export async function incrementInWindow(
  key: string,
  amount: number,
  windowInSeconds: number
): Promise<number> {
  return backend().incrementInWindow(key, amount, windowInSeconds)
}

export async function setFieldWithExpiry(
  key: string,
  field: string,
  value: unknown,
  ttlInSeconds: number
): Promise<void> {
  return backend().setFieldWithExpiry(key, field, value, ttlInSeconds)
}

export async function slidingWindow(
  key: string,
  tokens: number,
  window: Duration
): Promise<{ success: boolean }> {
  return backend().slidingWindow(key, tokens, window)
}

export async function assertConfigured(): Promise<void> {
  return backend().assertConfigured()
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

export default memcache

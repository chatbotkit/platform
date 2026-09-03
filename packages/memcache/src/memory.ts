// @note the community key-value default: the in-process backend.
//
// An in-process store implementing the whole of @chatbotkit-dev/memcache-spec,
// so that the platform runs with no key-value service configured at all. It is
// selected by ./index.ts when no REDIS_URL is configured; with a REDIS_URL the
// Redis backend in ./redis.ts takes over and this store is never touched. Unlike
// the storage default this is not a placeholder that refuses: caches, sessions,
// rate limits, dedupe markers and channel history all genuinely work against
// it.
//
// What it is not is *shared*. Every process gets its own store, so a
// multi-instance deployment has as many rate-limit counters as it has
// instances, and a restart is a cold start. That is a real limitation and it is
// the reason to install an override in production - see README.md. It is not a
// reason to make the default refuse, because a single-instance deployment is
// exactly the case this exists to serve.

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

export type * from '@chatbotkit-dev/memcache-spec'

/**
 * @note an in-process store has to be bounded or it is a memory leak with a
 * cache-shaped API. Entries are evicted least-recently-used once the store is
 * full, which is why every read moves its key to the end of the Map.
 */
const MAX_ENTRIES = 10_000

interface Entry {
  value: StoredValue
  expiresAt?: number
}

type StoredValue =
  | { kind: 'string'; data: string }
  | { kind: 'hash'; data: Map<string, string> }
  | { kind: 'set'; data: Set<string> }
  | { kind: 'zset'; data: Map<string, number> }
  | { kind: 'list'; data: string[] }
  | { kind: 'stream'; data: { id: string; fields: Record<string, string> }[] }

const store = new Map<string, Entry>()

// @note the serialization below is a deliberate port of what @upstash/redis
// does, not an independent choice, and the tests assert the surprising cases.
//
// A store that handed back the same object reference it was given would let one
// caller's mutation silently corrupt every later reader - a bug that exists
// only on this implementation and vanishes the moment a deployment installs a
// real backend, which is the worst possible place for it to live. So values
// round trip through a string here exactly as they do over the wire.
//
// The consequences are not all obvious, and platform code already depends on
// them. `set(key, '1')` reads back as the number 1. `set(key, JSON.stringify(x))`
// reads back as `x` rather than as the string, which is why the call sites in
// `lib/mcp.oauth.ts` that stringify on the way in do not parse on the way out.

export function serialize(value: unknown): string {
  switch (typeof value) {
    case 'string': {
      return value
    }

    case 'number':
    case 'boolean': {
      return String(value)
    }

    default: {
      return JSON.stringify(value)
    }
  }
}

export function deserialize<TData>(raw: string | undefined | null): TData | null {
  if (raw === undefined || raw === null) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)

    // @note upstash's guard, kept: a value that parses as a number but does not
    // survive the round trip - `007`, or an integer wider than a double - is
    // returned as the original string rather than as a corrupted number.

    if (typeof parsed === 'number' && parsed.toString() !== raw) {
      return raw as TData
    }

    return parsed as TData
  } catch {
    return raw as TData
  }
}

function now(): number {
  return Date.now()
}

function isExpired(entry: Entry): boolean {
  return entry.expiresAt !== undefined && entry.expiresAt <= now()
}

/**
 * Reads an entry, dropping it first if it has expired and refreshing its
 * recency if it has not.
 */
function read(key: string): Entry | undefined {
  const entry = store.get(key)

  if (!entry) {
    return undefined
  }

  if (isExpired(entry)) {
    store.delete(key)

    return undefined
  }

  store.delete(key)
  store.set(key, entry)

  return entry
}

function write(key: string, value: StoredValue, expiresAt?: number): void {
  store.delete(key)
  store.set(key, { value, expiresAt })

  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next()

    if (oldest.done) {
      break
    }

    store.delete(oldest.value)
  }
}

/**
 * Reads a container of the given kind, creating it when absent.
 *
 * @note a key holding the wrong kind is overwritten rather than raising Redis's
 * WRONGTYPE. The platform never does this, and reproducing the error faithfully
 * would mean reproducing its exact message for callers that do not read it.
 */
function container<TKind extends StoredValue['kind']>(
  key: string,
  kind: TKind,
  create: () => Extract<StoredValue, { kind: TKind }>
): { entry: Entry; value: Extract<StoredValue, { kind: TKind }> } {
  const existing = read(key)

  if (existing && existing.value.kind === kind) {
    return {
      entry: existing,
      value: existing.value as Extract<StoredValue, { kind: TKind }>,
    }
  }

  const value = create()

  write(key, value, existing?.expiresAt)

  return { entry: store.get(key)!, value }
}

/**
 * Redis glob matching - `*`, `?` and `[...]` - for `scan`.
 */
function globToRegExp(pattern: string): RegExp {
  let source = '^'

  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index]

    switch (character) {
      case '*': {
        source += '.*'

        break
      }

      case '?': {
        source += '.'

        break
      }

      case '[': {
        const close = pattern.indexOf(']', index)

        if (close === -1) {
          source += '\\['
        } else {
          source += pattern.slice(index, close + 1)
          index = close
        }

        break
      }

      default: {
        source += character.replace(/[.+^${}()|\\]/g, '\\$&')

        break
      }
    }
  }

  return new RegExp(source + '$')
}

function liveKeys(): string[] {
  const keys: string[] = []

  for (const [key, entry] of store) {
    if (isExpired(entry)) {
      store.delete(key)

      continue
    }

    keys.push(key)
  }

  return keys
}

/**
 * Resolves Redis's negative and out-of-range list indices to a slice.
 */
function resolveRange(
  length: number,
  start: number,
  stop: number
): [number, number] {
  let from = start < 0 ? length + start : start
  let to = stop < 0 ? length + stop : stop

  if (from < 0) {
    from = 0
  }

  if (to >= length) {
    to = length - 1
  }

  return [from, to]
}

export async function get<TData>(key: string): Promise<TData | null> {
  const entry = read(key)

  if (!entry || entry.value.kind !== 'string') {
    return null
  }

  return deserialize<TData>(entry.value.data)
}

export async function set<TData>(
  key: string,
  value: TData,
  options?: SetOptions
): Promise<'OK' | TData | null> {
  const existing = read(key)

  if (options?.nx && existing) {
    return null
  }

  if (options?.xx && !existing) {
    return null
  }

  let expiresAt: number | undefined

  if (options?.ex !== undefined) {
    expiresAt = now() + options.ex * 1000
  } else if (options?.px !== undefined) {
    expiresAt = now() + options.px
  }

  write(key, { kind: 'string', data: serialize(value) }, expiresAt)

  return 'OK'
}

export async function setex<TData>(
  key: string,
  seconds: number,
  value: TData
): Promise<'OK'> {
  write(
    key,
    { kind: 'string', data: serialize(value) },
    now() + seconds * 1000
  )

  return 'OK'
}

export async function getdel<TData>(key: string): Promise<TData | null> {
  const value = await get<TData>(key)

  store.delete(key)

  return value
}

export async function del(...keys: string[]): Promise<number> {
  let removed = 0

  for (const key of keys) {
    if (read(key)) {
      store.delete(key)

      removed++
    }
  }

  return removed
}

export async function incr(key: string): Promise<number> {
  const current = await get<unknown>(key)
  const next = (typeof current === 'number' ? current : 0) + 1

  const entry = store.get(key)

  write(key, { kind: 'string', data: String(next) }, entry?.expiresAt)

  return next
}

export async function ttl(key: string): Promise<number> {
  const entry = read(key)

  if (!entry) {
    return -2
  }

  if (entry.expiresAt === undefined) {
    return -1
  }

  return Math.ceil((entry.expiresAt - now()) / 1000)
}

export async function expire(key: string, seconds: number): Promise<0 | 1> {
  const entry = read(key)

  if (!entry) {
    return 0
  }

  entry.expiresAt = now() + seconds * 1000

  return 1
}

export async function scan(
  cursor: string | number,
  options?: ScanOptions
): Promise<[string, string[]]> {
  // @note the whole keyspace is returned in one page and the cursor is always
  // reported as complete. The contract allows this, and callers loop until the
  // cursor is '0' regardless, so a paging implementation would add a code path
  // that no test and no caller could tell apart.

  if (String(cursor) !== '0') {
    return ['0', []]
  }

  const keys = liveKeys()

  if (!options?.match) {
    return ['0', keys]
  }

  const pattern = globToRegExp(options.match)

  return ['0', keys.filter((key) => pattern.test(key))]
}

export async function hset(
  key: string,
  fields: Record<string, unknown>
): Promise<number> {
  const { value } = container(key, 'hash', () => ({
    kind: 'hash' as const,
    data: new Map<string, string>(),
  }))

  let added = 0

  for (const [field, fieldValue] of Object.entries(fields)) {
    if (!value.data.has(field)) {
      added++
    }

    value.data.set(field, serialize(fieldValue))
  }

  return added
}

export async function hgetall<TData extends Record<string, unknown>>(
  key: string
): Promise<TData | null> {
  const entry = read(key)

  if (!entry || entry.value.kind !== 'hash' || entry.value.data.size === 0) {
    return null
  }

  const result: Record<string, unknown> = {}

  for (const [field, raw] of entry.value.data) {
    result[field] = deserialize(raw)
  }

  return result as TData
}

export async function hdel(
  key: string,
  ...fields: string[]
): Promise<number> {
  const entry = read(key)

  if (!entry || entry.value.kind !== 'hash') {
    return 0
  }

  let removed = 0

  for (const field of fields) {
    if (entry.value.data.delete(field)) {
      removed++
    }
  }

  if (entry.value.data.size === 0) {
    store.delete(key)
  }

  return removed
}

export async function sadd<TData>(
  key: string,
  ...members: TData[]
): Promise<number> {
  // @note an empty call is a no-op that touches nothing, which is what the
  // Upstash-backed implementation does - its client types these as
  // `(key, member, ...members)`, so it returns early rather than sending a
  // command. Without this the two disagree: the store here would create the
  // container as a side effect, and the push variants would answer with the
  // length they already had rather than 0.

  if (members.length === 0) {
    return 0
  }

  const { value } = container(key, 'set', () => ({
    kind: 'set' as const,
    data: new Set<string>(),
  }))

  let added = 0

  for (const member of members) {
    const serialized = serialize(member)

    if (!value.data.has(serialized)) {
      value.data.add(serialized)

      added++
    }
  }

  return added
}

export async function srem<TData>(
  key: string,
  ...members: TData[]
): Promise<number> {
  const entry = read(key)

  if (!entry || entry.value.kind !== 'set') {
    return 0
  }

  let removed = 0

  for (const member of members) {
    if (entry.value.data.delete(serialize(member))) {
      removed++
    }
  }

  if (entry.value.data.size === 0) {
    store.delete(key)
  }

  return removed
}

export async function smembers<TData extends unknown[] = string[]>(
  key: string
): Promise<TData> {
  const entry = read(key)

  if (!entry || entry.value.kind !== 'set') {
    return [] as unknown as TData
  }

  return [...entry.value.data].map((raw) => deserialize(raw)) as TData
}

export async function zadd(
  key: string,
  member: SortedSetMember
): Promise<number | null> {
  const { value } = container(key, 'zset', () => ({
    kind: 'zset' as const,
    data: new Map<string, number>(),
  }))

  const added = value.data.has(member.member) ? 0 : 1

  value.data.set(member.member, member.score)

  return added
}

export async function zrange<TData extends unknown[]>(
  key: string,
  min: number | string,
  max: number | string,
  options?: ZRangeOptions
): Promise<TData> {
  const entry = read(key)

  if (!entry || entry.value.kind !== 'zset') {
    return [] as unknown as TData
  }

  const sorted = [...entry.value.data.entries()].sort((a, b) => a[1] - b[1])

  const ordered = options?.rev ? [...sorted].reverse() : sorted

  if (options?.byScore) {
    const low = typeof min === 'number' ? min : Number(min)
    const high = typeof max === 'number' ? max : Number(max)

    return ordered
      .filter(([, score]) => score >= low && score <= high)
      .map(([member]) => deserialize(member)) as TData
  }

  const [from, to] = resolveRange(ordered.length, Number(min), Number(max))

  return ordered
    .slice(from, to + 1)
    .map(([member]) => deserialize(member)) as TData
}

export async function zrem<TData>(
  key: string,
  ...members: TData[]
): Promise<number> {
  const entry = read(key)

  if (!entry || entry.value.kind !== 'zset') {
    return 0
  }

  let removed = 0

  for (const member of members) {
    if (entry.value.data.delete(serialize(member))) {
      removed++
    }
  }

  if (entry.value.data.size === 0) {
    store.delete(key)
  }

  return removed
}

function listContainer(key: string): string[] {
  return container(key, 'list', () => ({ kind: 'list' as const, data: [] }))
    .value.data
}

export async function lpush<TData>(
  key: string,
  ...elements: TData[]
): Promise<number> {
  // @note an empty call is a no-op that touches nothing, which is what the
  // Upstash-backed implementation does - its client types these as
  // `(key, member, ...members)`, so it returns early rather than sending a
  // command. Without this the two disagree: the store here would create the
  // container as a side effect, and the push variants would answer with the
  // length they already had rather than 0.

  if (elements.length === 0) {
    return 0
  }

  const list = listContainer(key)

  for (const element of elements) {
    list.unshift(serialize(element))
  }

  return list.length
}

export async function rpush<TData>(
  key: string,
  ...elements: TData[]
): Promise<number> {
  // @note an empty call is a no-op that touches nothing, which is what the
  // Upstash-backed implementation does - its client types these as
  // `(key, member, ...members)`, so it returns early rather than sending a
  // command. Without this the two disagree: the store here would create the
  // container as a side effect, and the push variants would answer with the
  // length they already had rather than 0.

  if (elements.length === 0) {
    return 0
  }

  const list = listContainer(key)

  for (const element of elements) {
    list.push(serialize(element))
  }

  return list.length
}

export async function lpop<TData>(key: string): Promise<TData | null> {
  const entry = read(key)

  if (!entry || entry.value.kind !== 'list' || entry.value.data.length === 0) {
    return null
  }

  const raw = entry.value.data.shift()

  if (entry.value.data.length === 0) {
    store.delete(key)
  }

  return deserialize<TData>(raw)
}

export async function rpop<TData = string>(
  key: string
): Promise<TData | null> {
  const entry = read(key)

  if (!entry || entry.value.kind !== 'list' || entry.value.data.length === 0) {
    return null
  }

  const raw = entry.value.data.pop()

  if (entry.value.data.length === 0) {
    store.delete(key)
  }

  return deserialize<TData>(raw)
}

export async function lrange<TResult = string>(
  key: string,
  start: number,
  stop: number
): Promise<TResult[]> {
  const entry = read(key)

  if (!entry || entry.value.kind !== 'list') {
    return []
  }

  const [from, to] = resolveRange(entry.value.data.length, start, stop)

  return entry.value.data
    .slice(from, to + 1)
    .map((raw) => deserialize<TResult>(raw) as TResult)
}

let streamSequence = 0

export async function xadd(
  key: string,
  id: string,
  data: Record<string, unknown>,
  options?: XAddOptions
): Promise<string | null> {
  const { value } = container(key, 'stream', () => ({
    kind: 'stream' as const,
    data: [],
  }))

  // @note ids must be strictly increasing, and two entries added in the same
  // millisecond are common in tests. The sequence counter is what Redis's own
  // `<ms>-<seq>` format is for.

  const resolved = id === '*' ? `${now()}-${streamSequence++}` : id

  const fields: Record<string, string> = {}

  for (const [field, fieldValue] of Object.entries(data)) {
    fields[field] = serialize(fieldValue)
  }

  value.data.push({ id: resolved, fields })

  if (options?.trim?.type === 'MAXLEN') {
    const excess = value.data.length - options.trim.threshold

    if (excess > 0) {
      value.data.splice(0, excess)
    }
  }

  if (options?.trim?.type === 'MINID') {
    const threshold = String(options.trim.threshold)

    while (value.data.length > 0 && value.data[0].id < threshold) {
      value.data.shift()
    }
  }

  return resolved
}

function streamEntries(
  key: string
): { id: string; fields: Record<string, string> }[] {
  const entry = read(key)

  if (!entry || entry.value.kind !== 'stream') {
    return []
  }

  return entry.value.data
}

function toStreamResult(
  entries: { id: string; fields: Record<string, string> }[]
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {}

  for (const { id, fields } of entries) {
    const parsed: Record<string, unknown> = {}

    for (const [field, raw] of Object.entries(fields)) {
      parsed[field] = deserialize(raw)
    }

    result[id] = parsed
  }

  return result
}

/**
 * @note `-` and `+` are Redis's "smallest" and "largest" id sentinels. Any other
 * bound is compared as a string, which is correct for the `<ms>-<seq>` format
 * only while the millisecond parts are the same width - true for every id
 * minted this side of the year 33658.
 */
function withinStreamBounds(id: string, low: string, high: string): boolean {
  if (low !== '-' && id < low) {
    return false
  }

  if (high !== '+' && id > high) {
    return false
  }

  return true
}

export async function xrange(
  key: string,
  start: string,
  end: string,
  count?: number
): Promise<Record<string, Record<string, unknown>>> {
  const entries = streamEntries(key).filter(({ id }) =>
    withinStreamBounds(id, start, end)
  )

  return toStreamResult(
    count === undefined ? entries : entries.slice(0, count)
  )
}

export async function xrevrange(
  key: string,
  end: string,
  start: string,
  count?: number
): Promise<Record<string, Record<string, unknown>>> {
  const entries = streamEntries(key)
    .filter(({ id }) => withinStreamBounds(id, start, end))
    .reverse()

  return toStreamResult(
    count === undefined ? entries : entries.slice(0, count)
  )
}

export function pipeline(): MemcachePipeline {
  const operations: (() => Promise<unknown>)[] = []

  const chain: MemcachePipeline = {
    get(key: string) {
      operations.push(() => get(key))

      return chain
    },

    del(...keys: string[]) {
      operations.push(() => del(...keys))

      return chain
    },

    ttl(key: string) {
      operations.push(() => ttl(key))

      return chain
    },

    async exec<TData = unknown[]>() {
      const results: unknown[] = []

      for (const operation of operations) {
        results.push(await operation())
      }

      return results as TData
    },
  }

  return chain
}

export async function incrementInWindow(
  key: string,
  amount: number,
  windowInSeconds: number
): Promise<number> {
  const entry = read(key)

  if (entry && entry.value.kind === 'string') {
    const current = deserialize<unknown>(entry.value.data)
    const next = (typeof current === 'number' ? current : 0) + amount

    // @note the existing expiry is preserved rather than extended. That is the
    // whole point of the operation: a window that slid forward on every
    // increment would never close, and the limit built on it would never fire.

    write(key, { kind: 'string', data: String(next) }, entry.expiresAt)

    return next
  }

  write(
    key,
    { kind: 'string', data: String(amount) },
    now() + windowInSeconds * 1000
  )

  return amount
}

export async function setFieldWithExpiry(
  key: string,
  field: string,
  value: unknown,
  ttlInSeconds: number
): Promise<void> {
  await hset(key, { [field]: value })

  await expire(key, ttlInSeconds)
}

const DURATION_UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
}

function durationToMilliseconds(window: Duration): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(window)

  if (!match) {
    throw new Error(
      `"${window}" is not a window length. Use a number and a unit, as in "10 s" or "60 m".`
    )
  }

  return Number(match[1]) * DURATION_UNITS[match[2]]
}

export async function slidingWindow(
  key: string,
  tokens: number,
  window: Duration
): Promise<{ success: boolean }> {
  // @note the two-window approximation @upstash/ratelimit uses: count this
  // fixed window in full, and the previous one weighted by however much of the
  // current window is left to run. It avoids storing a timestamp per request
  // while still not resetting the whole allowance on a window boundary.

  const windowInMilliseconds = durationToMilliseconds(window)

  const timestamp = now()
  const currentWindow = Math.floor(timestamp / windowInMilliseconds)

  const currentKey = `${key}:${currentWindow}`
  const previousKey = `${key}:${currentWindow - 1}`

  const current = (await get<number>(currentKey)) ?? 0
  const previous = (await get<number>(previousKey)) ?? 0

  const elapsed = (timestamp % windowInMilliseconds) / windowInMilliseconds

  const estimated = previous * (1 - elapsed) + current

  if (estimated >= tokens) {
    return { success: false }
  }

  // @note the counter outlives its own window by one, because the next window
  // reads it as the previous one.

  await incrementInWindow(
    currentKey,
    1,
    Math.ceil((windowInMilliseconds * 2) / 1000)
  )

  return { success: true }
}

// @note pub/sub, in-process: an emitter keyed by channel. Delivery is
// deferred a microtask so a publisher never runs subscriber code inside its
// own call stack - the same decoupling a networked backend gives for free.
// Like everything else in this store it is per-process: a subscriber in one
// instance never hears a publisher in another, which is the documented
// limitation of this backend and the reason multi-instance deployments set
// REDIS_URL or install an override.

type SubscribeHandlers = {
  onMessage: (message: string) => void
  onClose?: (error?: unknown) => void
}

const subscribers = new Map<string, Set<SubscribeHandlers>>()

export async function publish(
  channel: string,
  message: string
): Promise<number> {
  const handlers = subscribers.get(channel)

  if (!handlers || handlers.size === 0) {
    return 0
  }

  for (const handler of [...handlers]) {
    queueMicrotask(() => {
      handler.onMessage(message)
    })
  }

  return handlers.size
}

export async function subscribe(
  channel: string,
  handlers: SubscribeHandlers
): Promise<{ unsubscribe(): Promise<void> }> {
  let channelHandlers = subscribers.get(channel)

  if (!channelHandlers) {
    channelHandlers = new Set()

    subscribers.set(channel, channelHandlers)
  }

  channelHandlers.add(handlers)

  return {
    async unsubscribe() {
      const current = subscribers.get(channel)

      if (!current) {
        return
      }

      current.delete(handlers)

      if (current.size === 0) {
        subscribers.delete(channel)
      }
    },
  }
}

export async function assertConfigured(): Promise<void> {
  // @note nothing to configure. This is a working store, so it resolves - the
  // same call the console email transport makes. What it cannot do is share
  // state between processes, and no assertion made from inside one process can
  // detect that, so the warning lives in the README where a deployer reads it.
}

/**
 * Empties the store.
 *
 * @note not part of the contract - tests reach for it, and a caller that has
 * one of these in its hands already knows which implementation it holds.
 */
export function reset(): void {
  store.clear()
  subscribers.clear()

  streamSequence = 0
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


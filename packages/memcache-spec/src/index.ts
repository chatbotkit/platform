// @note the key-value store contract.
//
// The platform keeps caches, sessions, rate-limit counters, dedupe markers,
// idle-conversation timers, sandbox state and channel history in a key-value
// store. Which store that is, is a deployment's choice, so the platform is
// written against this contract rather than against a vendor's client.
//
// The shape here is deliberately Redis-flavoured, and that is a decision rather
// than an accident. Fifty-two platform modules use thirty commands across
// strings, hashes, sets, sorted sets, lists and streams; renaming those into an
// invented vocabulary would be a large translation with no reader on the other
// side, since every backend anyone would plausibly install speaks this
// vocabulary already. What the contract does buy is that the types are *ours*.
// Nothing in the platform imports `@upstash/redis`, so the client can be
// replaced without a single caller changing, and the in-memory default in
// `@chatbotkit-dev/memcache` exists to keep that claim honest.
//
// The exception is Lua, and it is instructive. See `incrementInWindow` and
// `setFieldWithExpiry` at the bottom of this file.

export interface ScanOptions {
  match?: string
  count?: number
}

/**
 * @note `ex`/`px` are the Redis argument names, kept for the reason given at
 * the top of the file: the whole surface speaks this vocabulary, and a contract
 * that half-translates it is harder to read than one that does not translate it
 * at all.
 */
export interface SetOptions {
  /** Expire after this many seconds. */
  ex?: number

  /** Expire after this many milliseconds. */
  px?: number

  /** Only set when the key does not already exist. */
  nx?: boolean

  /** Only set when the key already exists. */
  xx?: boolean
}

/**
 * A window length, as `@upstash/ratelimit` spells it - `'10 s'`, `'60 m'`.
 */
export type Duration =
  | `${number} ${'ms' | 's' | 'm' | 'h' | 'd'}`
  | `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`

export interface SortedSetMember {
  score: number
  member: string
}

export interface ZRangeOptions {
  /** Treat `min` and `max` as scores rather than ranks. */
  byScore?: boolean

  rev?: boolean
}

export interface XAddOptions {
  trim?: {
    type: 'MAXLEN' | 'MINID'
    threshold: number

    /** `~` trims approximately, which is cheaper and usually what is wanted. */
    comparison?: '~' | '='
  }
}

/**
 * A batch of commands sent in one round trip.
 *
 * @note only `get`, `del` and `ttl` are on this interface because only those
 * three are ever batched - see `lib/limit.core.js`, which reads and clears a
 * user's usage counters, and `lib/usage.get.ts`, which reads values and their
 * expiries together. An implementation with no real batching may run them in
 * sequence; the platform depends on the results, not on the round trips.
 *
 * `exec` takes the result tuple as a type argument rather than accumulating one
 * command by command. The accumulating version is a large amount of variadic
 * type machinery serving two call sites, one of which is JavaScript and gets
 * nothing from it.
 */
/**
 * A live pub/sub subscription. `unsubscribe` stops delivery and releases
 * whatever the backend holds for it - a handler registration, a dedicated
 * subscriber connection, an open SSE stream.
 */
export interface MemcacheSubscription {
  unsubscribe(): Promise<void>
}

export interface MemcachePipeline {
  get(key: string): MemcachePipeline
  del(...keys: string[]): MemcachePipeline
  ttl(key: string): MemcachePipeline
  exec<TData = unknown[]>(): Promise<TData>
}

// @note the generic parameters below mirror @upstash/redis exactly, including
// which ones carry a default and which do not, and that is load-bearing rather
// than deference.
//
// A type parameter with a default is resolved to that default when no argument
// constrains it. Without one, TypeScript infers it from the contextual type of
// wherever the result is being assigned. The platform's integration queue
// handlers are JavaScript, so they pass no type argument and rely entirely on
// that inference - `get` returning `TData` with no default is what makes
// `const id: string | null = await redis.get(key)` check in an untyped file.
// Adding a tidy-looking `= unknown` to these breaks eleven call sites in six
// files, none of which can be fixed locally because there is nowhere in a .js
// file to put the annotation.

export interface MemcacheProvider {
  // strings and keys

  get<TData>(key: string): Promise<TData | null>

  set<TData>(
    key: string,
    value: TData,
    options?: SetOptions
  ): Promise<'OK' | TData | null>

  setex<TData>(key: string, seconds: number, value: TData): Promise<'OK'>

  /** Reads and removes in one operation. */
  getdel<TData>(key: string): Promise<TData | null>

  del(...keys: string[]): Promise<number>

  incr(key: string): Promise<number>

  /** Seconds remaining. `-1` when the key has no expiry, `-2` when it is gone. */
  ttl(key: string): Promise<number>

  expire(key: string, seconds: number): Promise<0 | 1>

  /**
   * Pages through the keyspace. Returns the cursor to pass back and the keys
   * found; a `'0'` cursor means the sweep is complete.
   *
   * @note callers must treat the page size as advisory and the cursor as
   * opaque. A backend is allowed to return zero keys for a non-zero cursor.
   */
  scan(
    cursor: string | number,
    options?: ScanOptions
  ): Promise<[string, string[]]>

  // hashes

  hgetall<TData extends Record<string, unknown>>(
    key: string
  ): Promise<TData | null>

  hdel(key: string, ...fields: string[]): Promise<number>

  // sets

  sadd<TData>(key: string, ...members: TData[]): Promise<number>

  srem<TData>(key: string, ...members: TData[]): Promise<number>

  smembers<TData extends unknown[] = string[]>(key: string): Promise<TData>

  // sorted sets

  zadd(key: string, member: SortedSetMember): Promise<number | null>

  zrange<TData extends unknown[]>(
    key: string,
    min: number | string,
    max: number | string,
    options?: ZRangeOptions
  ): Promise<TData>

  zrem<TData>(key: string, ...members: TData[]): Promise<number>

  // lists

  lpush<TData>(key: string, ...elements: TData[]): Promise<number>

  rpush<TData>(key: string, ...elements: TData[]): Promise<number>

  lpop<TData>(key: string): Promise<TData | null>

  rpop<TData = string>(key: string): Promise<TData | null>

  lrange<TResult = string>(
    key: string,
    start: number,
    stop: number
  ): Promise<TResult[]>

  // streams

  xadd(
    key: string,
    id: string,
    data: Record<string, unknown>,
    options?: XAddOptions
  ): Promise<string | null>

  xrange(
    key: string,
    start: string,
    end: string,
    count?: number
  ): Promise<Record<string, Record<string, unknown>>>

  xrevrange(
    key: string,
    end: string,
    start: string,
    count?: number
  ): Promise<Record<string, Record<string, unknown>>>

  // pub/sub

  /**
   * Delivers `message` to the channel's current subscribers. Fire-and-forget
   * fan-out: no history and no acknowledgement - pair it with a stream (see
   * `xadd`) when replay matters, which is exactly what the platform's channel
   * layer does. Returns the number of subscribers that received it, where the
   * backend can know that.
   *
   * @note pub/sub is on the contract for the same reason the Lua operations
   * are. The realtime channel layer used to call its vendor's REST subscribe
   * endpoint directly, which made it the last transport in the platform that
   * only one backend could satisfy. Every backend anyone would plausibly
   * install speaks publish/subscribe - Redis natively, an in-process store
   * with an emitter - so the contract carries the operation and the backend
   * owns the wire.
   */
  publish(channel: string, message: string): Promise<number>

  /**
   * Subscribes to `channel`. The returned promise resolves once the
   * subscription is active - after that, a publish observed by the backend is
   * delivered to `onMessage`. `onClose` fires at most once when the
   * subscription ends for any reason other than `unsubscribe` - a dropped
   * connection, a closed stream - with the error when there was one; callers
   * that must stay subscribed resubscribe from it.
   */
  subscribe(
    channel: string,
    handlers: {
      onMessage: (message: string) => void
      onClose?: (error?: unknown) => void
    }
  ): Promise<MemcacheSubscription>

  // batching

  pipeline(): MemcachePipeline

  // atomic operations that were Lua

  /**
   * Adds `amount` to a counter, starting a fresh `windowInSeconds` window when
   * the counter does not exist. Returns the value after the increment.
   *
   * @note this was a Lua script, evaluated in three places - twice byte for
   * byte identical, in `lib/usage.record.ts` and `lib/usage.policy.ts`. The
   * script is not the point; the point is that a counter must not be
   * incremented and expired in two round trips, or a burst of concurrent
   * requests silently resets the window and the limit stops holding.
   *
   * It is on the contract as an operation rather than as `eval` for two
   * reasons. Lua is a Redis feature, not a key-value one, so a contract
   * carrying `eval` cannot be implemented by anything that is not Redis - which
   * would have made the in-memory default impossible and every future backend
   * an embedded Lua runtime. And the platform did not want to run a script; it
   * wanted this. A Redis implementation still uses EVAL, privately.
   */
  incrementInWindow(
    key: string,
    amount: number,
    windowInSeconds: number
  ): Promise<number>

  /**
   * Writes one field of a hash and sets the whole hash's expiry, atomically.
   *
   * @note the second Lua script, from `lib/tool.environment.ts`. Field-at-a-time
   * writes are what let an install of one tool source avoid clobbering a
   * concurrent install of another, so the write and the expiry cannot be two
   * commands - a crash between them leaves the hash immortal.
   */
  setFieldWithExpiry(
    key: string,
    field: string,
    value: unknown,
    ttlInSeconds: number
  ): Promise<void>

  /**
   * Consumes one token against a sliding window, answering whether the caller
   * is within its limit.
   *
   * @note this is on the contract for the same reason the two Lua operations
   * are, and it was very nearly missed. `lib/ratelimit.ts` did not use the
   * key-value client to count anything - it handed the client itself to
   * `@upstash/ratelimit`, which reaches into it for `eval` and `evalsha`. A
   * client that is passed to a vendor library is not an implementation detail
   * the contract can hide; it is a second, undeclared contract, and it is
   * satisfied by exactly one implementation.
   *
   * Rate limiting is the operation the platform wanted. Where the counting
   * happens, and whether it happens in Lua, belongs to the backend.
   */
  slidingWindow(
    key: string,
    tokens: number,
    window: Duration
  ): Promise<{ success: boolean }>

  /**
   * @note the convention every swappable module follows. See
   * packages/AGENTS.md.
   */
  assertConfigured(): Promise<void>
}

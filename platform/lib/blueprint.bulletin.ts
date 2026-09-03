import {
  ONE_DAY_IN_SECONDS,
  ONE_WEEK_IN_SECONDS,
  parseDuration,
} from '@chatbotkit-dev/time'

import { cuid } from '@/lib/cuid'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import memcache from '@/lib/memcache'

// @note shared between the agent-facing bulletin action
// (lib/action.exec.blueprint.ts) and the public blueprint API routes
// (pages/api/v1/blueprint/[blueprintId]/bulletin/*) so the read/write/expiry
// logic never diverges between the two surfaces.

/**
 * Maximum number of bulletins retained per blueprint. When the board is full
 * the oldest bulletins are evicted to make room for new ones.
 */
export const BULLETIN_MAX_MESSAGES = 50

/**
 * Default time-to-live (in seconds) applied when an agent does not specify one.
 */
export const BULLETIN_DEFAULT_TTL_SECONDS = ONE_DAY_IN_SECONDS

/**
 * Minimum time-to-live (in seconds) for a bulletin.
 */
export const BULLETIN_MIN_TTL_SECONDS = 1

/**
 * Maximum time-to-live (in seconds) for a bulletin. Also used as the key-level
 * expiry so an idle board self-cleans.
 */
export const BULLETIN_MAX_TTL_SECONDS = ONE_WEEK_IN_SECONDS

/**
 * Maximum length of a bulletin's text body.
 */
export const BULLETIN_MAX_TEXT_LENGTH = 4000

/**
 * A single bulletin left on a blueprint's shared board.
 */
export interface BlueprintBulletin {
  /** Unique identifier for the bulletin */
  id: string
  /** The message body */
  text: string
  /** The display name of the bulletin's author (a bot or a user), when known */
  author?: string
  /** The id of the bot the bulletin is associated with, when posted by a bot */
  botId?: string
  /** Creation time as an epoch millisecond timestamp */
  createdAt: number
  /** Expiry time as an epoch millisecond timestamp */
  expiresAt: number
}

/**
 * Builds the Redis key for a blueprint's shared bulletin board. The board is
 * scoped to the blueprint only, so it is shared across every conversation and
 * end-user of that blueprint.
 */
export function getBlueprintBulletinKey(blueprintId: string): string {
  return `bulletin:${blueprintId}`
}

/**
 * Resolves a caller-supplied ttl into a number of seconds. Accepts either a
 * number of seconds (backwards compatible) or a human-readable duration string
 * such as `"1 hour"`, `"30 minutes"`, `"2d"` or `"1 day, 12 hours"` (parsed via
 * {@link parseDuration}).
 *
 * A bare numeric value - a number or a numeric string like `"3600"` - is always
 * treated as seconds so it matches this field's historical seconds-based unit;
 * only strings carrying units are read as durations. (This intentionally differs
 * from {@link parseDuration}, which reads a bare number as milliseconds.)
 *
 * Returns undefined when no ttl is supplied, letting the default apply.
 *
 * @throws {UserInputError} when a non-empty string cannot be parsed as a duration.
 */
export function resolveTtlSeconds(ttl?: number | string): number | undefined {
  if (ttl === undefined || ttl === null) {
    return undefined
  }

  // @note a number is already expressed in seconds
  if (typeof ttl === 'number') {
    return Number.isFinite(ttl) ? ttl : undefined
  }

  const text = ttl.trim()

  if (!text) {
    return undefined
  }

  // @note a bare numeric string is seconds too, mirroring the numeric form
  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    const seconds = Number(text)

    return Number.isFinite(seconds) ? seconds : undefined
  }

  // @note anything else is a duration string; parseDuration yields milliseconds
  const ms = parseDuration(text)

  if (ms === null) {
    throw new UserInputError(`Invalid ttl duration: "${ttl}"`)
  }

  return ms / 1000
}

/**
 * Clamps a requested ttl (in seconds) to the allowed range, falling back to the
 * default when none is provided.
 */
function clampTtlSeconds(ttl?: number): number {
  if (typeof ttl !== 'number' || !Number.isFinite(ttl)) {
    return BULLETIN_DEFAULT_TTL_SECONDS
  }

  return Math.min(
    Math.max(Math.floor(ttl), BULLETIN_MIN_TTL_SECONDS),
    BULLETIN_MAX_TTL_SECONDS
  )
}

/**
 * Drops expired bulletins relative to the supplied timestamp.
 */
function pruneExpired(
  bulletins: BlueprintBulletin[],
  now: number
): BlueprintBulletin[] {
  return bulletins.filter((bulletin) => bulletin.expiresAt > now)
}

/**
 * Lists the active (non-expired) bulletins for a blueprint, newest first.
 */
export async function listBlueprintBulletins(
  blueprintId: string
): Promise<BlueprintBulletin[]> {
  const key = getBlueprintBulletinKey(blueprintId)

  const stored = (await memcache.get<BlueprintBulletin[]>(key)) ?? []

  // @note storage keeps bulletins oldest-first (new ones are appended and the
  // oldest are evicted at capacity); reverse a copy for the read path so callers
  // see the most recent bulletins first
  const active = pruneExpired(stored, Date.now()).reverse()

  debug(`list blueprint bulletins`, {
    key,
    stored: stored.length,
    active: active.length,
  }).log('blueprint.bulletin.listBlueprintBulletins')

  return active
}

/**
 * Creates a new bulletin on a blueprint's shared board, pruning expired entries
 * and enforcing the per-board maximum. Returns the created bulletin.
 */
export async function createBlueprintBulletin(
  blueprintId: string,
  {
    text,
    ttl,
    author,
    botId,
  }: {
    text: string
    ttl?: number | string
    author?: string
    botId?: string
  }
): Promise<BlueprintBulletin> {
  const key = getBlueprintBulletinKey(blueprintId)

  const now = Date.now()
  const ttlSeconds = clampTtlSeconds(resolveTtlSeconds(ttl))

  const bulletin: BlueprintBulletin = {
    id: cuid(),
    text: text.slice(0, BULLETIN_MAX_TEXT_LENGTH),
    ...(author ? { author } : {}),
    ...(botId ? { botId } : {}),
    createdAt: now,
    expiresAt: now + ttlSeconds * 1000,
  }

  const stored = (await memcache.get<BlueprintBulletin[]>(key)) ?? []

  let next = [...pruneExpired(stored, now), bulletin]

  // @note keep only the most recent bulletins when the board is over capacity
  if (next.length > BULLETIN_MAX_MESSAGES) {
    next = next.slice(next.length - BULLETIN_MAX_MESSAGES)
  }

  // @note key-level expiry ensures an idle board self-cleans
  await memcache.set(key, next, { ex: BULLETIN_MAX_TTL_SECONDS })

  debug(`create blueprint bulletin`, {
    key,
    id: bulletin.id,
    ttlSeconds,
    count: next.length,
  }).log('blueprint.bulletin.createBlueprintBulletin')

  return bulletin
}

/* eslint-disable no-restricted-globals */

// @note the Qdrant backend: records and vectors in a Qdrant server, selected
// by QDRANT_URL - see index.ts for how. Embedding still happens here, with the
// same OpenAI call the file backend makes: Qdrant indexes vectors, it does not
// produce them, so the contract's text-in/text-out shape is honoured by
// embedding on the way in and searching by vector underneath.
//
// The mapping, stated once:
//
// - one Qdrant collection per dataset, created on first write with the
//   embedding's dimension and cosine distance, so scores land in the same
//   0..1 the file backend produces and `minScore` means the same thing
// - Qdrant point ids must be UUIDs or integers, and the platform's record ids
//   are arbitrary strings, so the point id is a UUID derived from the record
//   id (SHA-1, v5-style) and the real id rides in the payload
// - `expiresAt` has no server-side TTL; liveness is a filter applied on every
//   read, exactly as the file backend applies it on read. Expired points stay
//   until overwritten or removed; they are never returned.
// - a missing collection is an empty dataset, not an error: searches return
//   nothing, counts return zero, purge succeeds. Only `fetch` turns it into
//   `RECORD_NOT_FOUND`, which is what the contract asks of a missing record.
//
// Talked to over raw REST rather than through @qdrant/js-client-rest, for the
// same reason embed.ts speaks to its endpoint with fetch: the surface this
// package uses is a handful of routes, and a dependency-free module runs
// anywhere fetch does.

import type {
  VectorFilter,
  VectorListResult,
  VectorMatch,
  VectorProvider,
  VectorRecord,
  VectorScope,
  VectorSearchOptions,
  VectorFetchOptions,
  VectorListOptions,
  VectorRemoveBySourceOptions,
  VectorRemoveOptions,
  VectorUpsertOptions,
} from '@chatbotkit-dev/vector-spec'

import { embed, truncate } from './embed'
import { VectorError } from './error'

interface PointPayload {
  id: string
  text: string
  source?: string
  meta?: Record<string, unknown>
  createdAt: number
  updatedAt: number
  expiresAt?: number
}

interface Point {
  id: string | number
  payload?: PointPayload
  score?: number
}

type Condition = Record<string, unknown>

function getConfig(): { url: string; apiKey?: string } {
  const url = process.env.QDRANT_URL

  if (!url) {
    throw new VectorError(
      'VECTOR_UNAVAILABLE',
      'QDRANT_URL is not set, so the Qdrant backend cannot be reached'
    )
  }

  return {
    url: url.replace(/\/+$/, ''),

    ...(process.env.QDRANT_API_KEY
      ? { apiKey: process.env.QDRANT_API_KEY }
      : undefined),
  }
}

interface Outcome<TResult> {
  ok: boolean
  status: number
  result?: TResult
  detail?: string
}

/**
 * One round trip to the server. Every non-auth status is returned rather than
 * thrown, because a 404 means different things to different operations.
 *
 * @throws `VECTOR_UNAVAILABLE` when the server cannot be reached and
 * `NOT_AUTHORIZED` when it rejects the credentials - the two failures no
 * caller can do anything else with
 */
async function api<TResult>(
  method: string,
  path: string,
  body?: unknown
): Promise<Outcome<TResult>> {
  const { url, apiKey } = getConfig()

  let response: Response

  try {
    response = await globalThis.fetch(`${url}${path}`, {
      method,

      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'api-key': apiKey } : undefined),
      },

      ...(body !== undefined ? { body: JSON.stringify(body) } : undefined),
    })
  } catch (error) {
    throw new VectorError(
      'VECTOR_UNAVAILABLE',
      `the Qdrant server at ${url} could not be reached`,
      { detail: error instanceof Error ? error.message : String(error) }
    )
  }

  if (response.status === 401 || response.status === 403) {
    throw new VectorError(
      'NOT_AUTHORIZED',
      'the Qdrant server rejected the credentials - check QDRANT_API_KEY',
      { detail: await response.text() }
    )
  }

  const text = await response.text()

  let parsed: { result?: TResult; status?: unknown } | undefined

  try {
    parsed = text ? JSON.parse(text) : undefined
  } catch {
    parsed = undefined
  }

  return {
    ok: response.ok,
    status: response.status,
    result: parsed?.result,

    ...(response.ok ? undefined : { detail: text }),
  }
}

/**
 * Unwraps an outcome, for call sites where any failure - 404 included - is a
 * real one.
 *
 * @throws `UNKNOWN` naming the action, with the server's answer as detail
 */
function must<TResult>(outcome: Outcome<TResult>, action: string): TResult {
  if (!outcome.ok) {
    throw new VectorError(
      'UNKNOWN',
      `Qdrant did not ${action} (status ${outcome.status})`,
      { detail: outcome.detail }
    )
  }

  return outcome.result as TResult
}

async function sha1Hex(input: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-1',
    new TextEncoder().encode(input)
  )

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

/**
 * @note a v5-style UUID derived from the record id, because Qdrant will not
 * take an arbitrary string as a point id. Deterministic, so the same record id
 * always lands on the same point and upsert semantics survive the mapping.
 */
async function pointId(recordId: string): Promise<string> {
  const hex = await sha1Hex(recordId)

  const bytes = hex.slice(0, 32).split('')

  bytes[12] = '5'
  bytes[16] = ((parseInt(bytes[16], 16) & 0x3) | 0x8).toString(16)

  const uuid = bytes.join('')

  return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`
}

/**
 * @note the readable half is for a human looking at the Qdrant dashboard; the
 * hash suffix is what makes the name injective. Sanitising two different
 * dataset ids can produce the same readable prefix, and the hash of the
 * unsanitised id cannot.
 */
async function collectionName(datasetId: string) {
  const tag = (await sha1Hex(datasetId)).slice(0, 8)

  const clean = (part: string) =>
    part.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 48)

  return `${clean(datasetId)}--${tag}`
}

/** Collections known to exist, so only the first write to a dataset checks. */
const known = new Set<string>()

async function ensureCollection(
  collection: string,
  dimension: number
): Promise<void> {
  if (known.has(collection)) {
    return
  }

  const found = await api('GET', `/collections/${collection}`)

  if (!found.ok) {
    const created = await api('PUT', `/collections/${collection}`, {
      vectors: { size: dimension, distance: 'Cosine' },
    })

    // @note 409 is another writer winning the race to create it, which is the
    // outcome this function wanted anyway

    if (!created.ok && created.status !== 409) {
      must(created, `create the collection ${collection}`)
    }
  }

  known.add(collection)
}

/**
 * At most one live-ness clause: not expired, or never expiring. Nested as a
 * sub-filter so it composes with the caller's own conditions under AND.
 */
function liveness(now: number): Condition {
  return {
    should: [
      { is_empty: { key: 'expiresAt' } },
      { key: 'expiresAt', range: { gt: now } },
    ],
  }
}

/**
 * The contract's filter language on Qdrant's. Semantics follow the file
 * backend exactly: equality works on any scalar, the ordering operators match
 * numbers only, and `$ne` matches records that lack the key at all.
 *
 * @note number equality goes through `range` rather than `match`, because
 * Qdrant's `match` takes keywords, integers and booleans but not floats.
 */
function mapFilter(filter: VectorFilter | undefined, now: number): Condition {
  const must: Condition[] = [liveness(now)]
  const mustNot: Condition[] = []

  for (const [key, operand] of Object.entries(filter ?? {})) {
    const field = `meta.${key}`

    if (typeof operand !== 'object' || operand === null) {
      must.push(
        typeof operand === 'number'
          ? { key: field, range: { gte: operand, lte: operand } }
          : { key: field, match: { value: operand } }
      )
    } else if ('$eq' in operand) {
      must.push(
        typeof operand.$eq === 'number'
          ? { key: field, range: { gte: operand.$eq, lte: operand.$eq } }
          : { key: field, match: { value: operand.$eq } }
      )
    } else if ('$ne' in operand) {
      mustNot.push(
        typeof operand.$ne === 'number'
          ? { key: field, range: { gte: operand.$ne, lte: operand.$ne } }
          : { key: field, match: { value: operand.$ne } }
      )
    } else if ('$gt' in operand) {
      must.push({ key: field, range: { gt: operand.$gt } })
    } else if ('$gte' in operand) {
      must.push({ key: field, range: { gte: operand.$gte } })
    } else if ('$lt' in operand) {
      must.push({ key: field, range: { lt: operand.$lt } })
    } else if ('$lte' in operand) {
      must.push({ key: field, range: { lte: operand.$lte } })
    }
  }

  return {
    must,

    ...(mustNot.length > 0 ? { must_not: mustNot } : undefined),
  }
}

function isLive(payload: PointPayload, now: number): boolean {
  return payload.expiresAt === undefined || payload.expiresAt > now
}

function toRecord(payload: PointPayload): VectorRecord {
  return {
    id: payload.id,
    text: payload.text,

    ...(payload.source ? { source: payload.source } : undefined),
    ...(payload.meta ? { meta: payload.meta } : undefined),

    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
  }
}

export async function upsert(options: VectorUpsertOptions): Promise<void> {
  const { datasetId, records } = options

  if (records.length === 0) {
    return
  }

  // @note embedded before anything touches the server, mirroring the file
  // backend: embedding is the slow, paid round trip, and a batch that fails to
  // embed should fail before it half-writes.

  const vectors = await embed(records.map((record) => record.text))

  const collection = await collectionName(datasetId)

  await ensureCollection(collection, vectors[0].length)

  const ids = await Promise.all(records.map((record) => pointId(record.id)))

  // @note existing creation times are read first so that re-upserting a
  // record keeps its `createdAt`, as the contract's file backend does

  const existing = await api<Point[]>(
    'POST',
    `/collections/${collection}/points`,
    { ids, with_payload: true, with_vector: false }
  )

  const createdAtByPoint = new Map<string, number>()

  if (existing.ok) {
    for (const point of existing.result ?? []) {
      if (point.payload?.createdAt !== undefined) {
        createdAtByPoint.set(String(point.id), point.payload.createdAt)
      }
    }
  }

  const now = Date.now()

  const points = records.map((record, index) => ({
    id: ids[index],
    vector: vectors[index],

    payload: {
      id: record.id,

      // @note stored truncated rather than whole, so that what comes back
      // from `fetch` is what was actually indexed - same reasoning as the
      // file backend

      text: truncate(record.text),

      ...(record.source ? { source: record.source } : undefined),
      ...(record.meta ? { meta: record.meta } : undefined),

      createdAt: createdAtByPoint.get(ids[index]) ?? now,
      updatedAt: now,

      ...(record.expiresAt !== undefined
        ? { expiresAt: record.expiresAt }
        : undefined),
    } satisfies PointPayload,
  }))

  must(
    await api('PUT', `/collections/${collection}/points?wait=true`, { points }),
    'accept the write'
  )
}

export async function fetch(
  options: VectorFetchOptions
): Promise<VectorRecord> {
  const { datasetId, recordId } = options

  const collection = await collectionName(datasetId)

  const outcome = await api<Point[]>(
    'POST',
    `/collections/${collection}/points`,
    { ids: [await pointId(recordId)], with_payload: true, with_vector: false }
  )

  const payload = outcome.ok ? outcome.result?.[0]?.payload : undefined

  if (!payload || !isLive(payload, Date.now())) {
    throw new VectorError(
      'RECORD_NOT_FOUND',
      `no record ${recordId} in dataset ${datasetId}`
    )
  }

  return toRecord(payload)
}

export async function list(
  options: VectorListOptions
): Promise<VectorListResult> {
  const { datasetId, cursor, limit = 100 } = options

  const collection = await collectionName(datasetId)

  // @note the cursor is Qdrant's `next_page_offset` - a point id - passed
  // back verbatim. Opaque by contract, so meaning something different from
  // the file backend's numeric offset is fine.

  const outcome = await api<{
    points: Point[]
    next_page_offset?: string | number | null
  }>('POST', `/collections/${collection}/points/scroll`, {
    limit,

    ...(cursor !== undefined ? { offset: cursor } : undefined),

    filter: { must: [liveness(Date.now())] },

    with_payload: true,
    with_vector: false,
  })

  if (outcome.status === 404) {
    return { records: [] }
  }

  if (!outcome.ok && outcome.status === 400) {
    throw new VectorError('VALIDATION_FAILED', `unusable cursor ${cursor}`, {
      detail: outcome.detail,
    })
  }

  const result = must(outcome, 'list the records')

  const next = result.next_page_offset

  return {
    records: result.points
      .filter((point) => point.payload)
      .map((point) => toRecord(point.payload as PointPayload)),

    ...(next !== null && next !== undefined
      ? { nextCursor: String(next) }
      : undefined),
  }
}

export async function count(options: VectorScope): Promise<number> {
  const { datasetId } = options

  const collection = await collectionName(datasetId)

  const outcome = await api<{ count: number }>(
    'POST',
    `/collections/${collection}/points/count`,
    { exact: true, filter: { must: [liveness(Date.now())] } }
  )

  if (outcome.status === 404) {
    return 0
  }

  return must(outcome, 'count the records').count
}

export async function search(
  options: VectorSearchOptions
): Promise<VectorMatch[]> {
  const { datasetId, query, minScore = 0, topK = 3, filter } = options

  // @note `alpha` is accepted and ignored, as on the file backend: retrieval
  // here is dense-only, and a hybrid parameter that silently changes nothing
  // is better than one that pretends.

  const collection = await collectionName(datasetId)

  const conditions = mapFilter(filter, Date.now())

  // @note counted before the query is embedded, so that searching an empty or
  // never-written dataset - the normal state of a new one - does not cost an
  // embedding call. Same economy as the file backend's empty-candidates path.

  const populated = await api<{ count: number }>(
    'POST',
    `/collections/${collection}/points/count`,
    { exact: true, filter: conditions }
  )

  if (!populated.ok || !populated.result || populated.result.count === 0) {
    return []
  }

  const [vector] = await embed([query])

  const outcome = await api<Point[]>(
    'POST',
    `/collections/${collection}/points/search`,
    {
      vector,
      limit: topK,
      score_threshold: minScore,
      filter: conditions,
      with_payload: true,
    }
  )

  if (outcome.status === 404) {
    return []
  }

  return must(outcome, 'search the records')
    .filter((point) => point.payload)
    .map((point) => ({
      ...toRecord(point.payload as PointPayload),

      score: point.score ?? 0,
    }))
}

export async function remove(options: VectorRemoveOptions): Promise<void> {
  const { datasetId, recordIds } = options

  if (recordIds.length === 0) {
    return
  }

  const collection = await collectionName(datasetId)

  const outcome = await api(
    'POST',
    `/collections/${collection}/points/delete?wait=true`,
    { points: await Promise.all(recordIds.map((id) => pointId(id))) }
  )

  if (outcome.status !== 404) {
    must(outcome, 'remove the records')
  }
}

export async function removeBySource(
  options: VectorRemoveBySourceOptions
): Promise<void> {
  const { datasetId, source } = options

  const collection = await collectionName(datasetId)

  const outcome = await api(
    'POST',
    `/collections/${collection}/points/delete?wait=true`,
    { filter: { must: [{ key: 'source', match: { value: source } }] } }
  )

  if (outcome.status !== 404) {
    must(outcome, 'remove the records by source')
  }
}

export async function purge(options: VectorScope): Promise<void> {
  const { datasetId } = options

  const collection = await collectionName(datasetId)

  // @note deleting a collection that does not exist succeeds by contract, and
  // Qdrant agrees - it answers ok either way

  await api('DELETE', `/collections/${collection}`)

  known.delete(collection)
}

/**
 * @note checks both halves, like the file backend: the server being there and
 * the embedding working. Either one missing makes the module useless in a
 * different way, and neither shows up until a user indexes something.
 */
export async function assertConfigured(): Promise<void> {
  const { url } = getConfig()

  const outcome = await api('GET', '/collections')

  if (!outcome.ok) {
    throw new Error(
      `the Qdrant server at ${url} answered ${outcome.status}, so no records could be stored or searched - check QDRANT_URL and QDRANT_API_KEY`
    )
  }

  try {
    await embed(['ok'])
  } catch (error) {
    throw new Error(
      `@chatbotkit-dev/vector could not embed text, so nothing could be indexed or searched (Qdrant at ${url} is reachable): ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

export const provider: VectorProvider = {
  upsert,
  fetch,
  list,
  count,
  search,
  remove,
  removeBySource,
  purge,
  assertConfigured,
}

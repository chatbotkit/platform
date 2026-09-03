// @note the file backend: records in JSON files, vectors from OpenAI,
// similarity computed here. This is the default the package serves when no
// QDRANT_URL is set - see index.ts for how a backend is chosen.
//
// It genuinely stores and retrieves - a dataset indexed here really is
// searchable by meaning. What it is not is fast, and the performance shape is
// stated where it lives, in `files.ts`: every search reads the whole dataset
// and scores every record. That is fine for the thousands of records a
// developer indexes and wrong for the millions a deployment holds - which is
// what the Qdrant backend is for.

import type {
  VectorFilter,
  VectorFilterOperand,
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
import { type StoredRecord, read, update, verifyWritable } from './files'

/**
 * @note cosine rather than inner product, so that scores land in 0..1 and the
 * platform's `minScore` thresholds - which were tuned against a backend that
 * also uses cosine - mean the same thing here. See the note on
 * `VectorMatch.score`.
 */
function cosine(a: number[], b: number[]): number {
  let dot = 0
  let magnitudeA = 0
  let magnitudeB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magnitudeA += a[i] * a[i]
    magnitudeB += b[i] * b[i]
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0
  }

  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
}

function matchesOperand(value: unknown, operand: VectorFilterOperand): boolean {
  if (typeof operand !== 'object' || operand === null) {
    return value === operand
  }

  if ('$eq' in operand) {
    return value === operand.$eq
  }

  if ('$ne' in operand) {
    return value !== operand.$ne
  }

  // @note the ordering operators compare numbers, and a record whose metadata
  // holds a string under that key is not a match rather than a coercion. `'10'
  // > 9` is true in JavaScript and false in every backend that would answer
  // this query, and a default that disagrees with the real one about which
  // records match is worse than a default that returns fewer.

  if (typeof value !== 'number') {
    return false
  }

  if ('$gt' in operand) {
    return value > operand.$gt
  }

  if ('$gte' in operand) {
    return value >= operand.$gte
  }

  if ('$lt' in operand) {
    return value < operand.$lt
  }

  if ('$lte' in operand) {
    return value <= operand.$lte
  }

  return false
}

function matchesFilter(
  record: StoredRecord,
  filter: VectorFilter | undefined
): boolean {
  if (!filter) {
    return true
  }

  return Object.entries(filter).every(([key, operand]) =>
    matchesOperand(record.meta?.[key], operand)
  )
}

/**
 * @note expiry is applied on read rather than by sweeping the files, because a
 * background sweep in a package with no process of its own is a timer that
 * fires whenever something happens to be importing it. Expired records stay on
 * disk until the dataset is next written; they are never returned.
 */
function isLive(record: StoredRecord, now: number): boolean {
  return record.expiresAt === undefined || record.expiresAt > now
}

/**
 * @note ordered by id rather than by insertion, so that `list` paginates over a
 * stable sequence. A cursor into an unordered object is a cursor that skips
 * records when an earlier one is deleted between pages.
 */
function live(records: Record<string, StoredRecord>, now: number) {
  return Object.values(records)
    .filter((record) => isLive(record, now))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

function toRecord(record: StoredRecord): VectorRecord {
  return {
    id: record.id,
    text: record.text,

    ...(record.source ? { source: record.source } : undefined),
    ...(record.meta ? { meta: record.meta } : undefined),

    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export async function upsert(options: VectorUpsertOptions): Promise<void> {
  const { datasetId, records } = options

  if (records.length === 0) {
    return
  }

  // @note embedded before the file is opened, and outside the per-dataset write
  // chain, because embedding is a network round trip and holding the chain
  // across it would serialise every concurrent import behind the slowest one.

  const vectors = await embed(records.map((record) => record.text))

  const now = Date.now()

  await update(datasetId, (dataset) => {
    records.forEach((record, index) => {
      const existing = dataset.records[record.id]

      dataset.records[record.id] = {
        id: record.id,

        // @note stored truncated rather than whole, so that what comes back
        // from `fetch` is what was actually indexed. A record whose text and
        // vector disagree is one that cannot be found by its own contents.
        text: truncate(record.text),

        ...(record.source ? { source: record.source } : undefined),
        ...(record.meta ? { meta: record.meta } : undefined),

        embedding: vectors[index],

        createdAt: existing?.createdAt ?? now,
        updatedAt: now,

        ...(record.expiresAt !== undefined
          ? { expiresAt: record.expiresAt }
          : undefined),
      }
    })
  })
}

export async function fetch(
  options: VectorFetchOptions
): Promise<VectorRecord> {
  const { datasetId, recordId } = options

  const dataset = await read(datasetId)

  const record = dataset.records[recordId]

  if (!record || !isLive(record, Date.now())) {
    throw new VectorError(
      'RECORD_NOT_FOUND',
      `no record ${recordId} in dataset ${datasetId}`
    )
  }

  return toRecord(record)
}

export async function list(
  options: VectorListOptions
): Promise<VectorListResult> {
  const { datasetId, cursor, limit = 100 } = options

  const dataset = await read(datasetId)

  const records = live(dataset.records, Date.now())

  // @note the cursor is an offset into that ordering. It is opaque to the
  // caller by contract, so a backend with real cursors is free to mean
  // something else by it.

  const offset = cursor ? Number(cursor) : 0

  if (!Number.isFinite(offset) || offset < 0) {
    throw new VectorError('VALIDATION_FAILED', `unusable cursor ${cursor}`)
  }

  const page = records.slice(offset, offset + limit)

  const next = offset + page.length

  return {
    records: page.map(toRecord),

    ...(next < records.length ? { nextCursor: String(next) } : undefined),
  }
}

export async function count(options: VectorScope): Promise<number> {
  const { datasetId } = options

  const dataset = await read(datasetId)

  return live(dataset.records, Date.now()).length
}

export async function search(
  options: VectorSearchOptions
): Promise<VectorMatch[]> {
  const { datasetId, query, minScore = 0, topK = 3, filter } = options

  // @note `alpha` is accepted and ignored. There is no sparse index here to
  // weight against a dense one, and a hybrid parameter that silently changes
  // nothing is better than one that pretends.

  const dataset = await read(datasetId)

  const candidates = live(dataset.records, Date.now()).filter((record) =>
    matchesFilter(record, filter)
  )

  if (candidates.length === 0) {
    // @note nothing to compare against, so the query is not embedded. Searching
    // an empty dataset is the normal state of a new one, and it should not cost
    // an API call.

    return []
  }

  const [vector] = await embed([query])

  return candidates
    .map((record) => ({
      ...toRecord(record),

      score: cosine(vector, record.embedding),
    }))
    .filter(({ score }) => score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

export async function remove(options: VectorRemoveOptions): Promise<void> {
  const { datasetId, recordIds } = options

  if (recordIds.length === 0) {
    return
  }

  await update(datasetId, (dataset) => {
    for (const recordId of recordIds) {
      delete dataset.records[recordId]
    }
  })
}

export async function removeBySource(
  options: VectorRemoveBySourceOptions
): Promise<void> {
  const { datasetId, source } = options

  await update(datasetId, (dataset) => {
    for (const [id, record] of Object.entries(dataset.records)) {
      if (record.source === source) {
        delete dataset.records[id]
      }
    }
  })
}

export async function purge(options: VectorScope): Promise<void> {
  const { datasetId } = options

  await update(datasetId, (dataset) => {
    dataset.records = {}
  })
}

/**
 * @note this checks both halves, because either one missing makes the module
 * useless in a different way and neither shows up until a user indexes
 * something. The embedding call is one token against the live endpoint, which
 * is what catches a key that is present but revoked - the failure a variable
 * check cannot see.
 */
export async function assertConfigured(): Promise<void> {
  let directory: string

  try {
    directory = await verifyWritable()
  } catch (error) {
    throw new Error(
      `@chatbotkit-dev/vector cannot write to its data directory, so records could not be stored: ${
        error instanceof Error ? error.message : String(error)
      } - set VECTOR_DATA_DIR to somewhere writable`
    )
  }

  try {
    await embed(['ok'])
  } catch (error) {
    throw new Error(
      `@chatbotkit-dev/vector could not embed text, so nothing could be indexed or searched (data directory ${directory}): ${
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

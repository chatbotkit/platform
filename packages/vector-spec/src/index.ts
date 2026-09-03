// @note the semantic storage contract.
//
// The platform keeps datasets of text that it later needs to retrieve by
// meaning rather than by key. Where that text lives, what turns it into
// vectors, and how similarity is computed, is a deployment's choice.
//
// The altitude decision here is different from the one on the sandbox and batch
// contracts, and it is the whole design. Those two had an obvious wrong answer
// in wrapping a vendor's REST surface. This one had an obvious wrong answer in
// wrapping the wrong *layer*: a contract that takes vectors.
//
// `embed(text) -> number[]` and `query(vector) -> matches` is the shape almost
// every vector database presents, and it is the shape the platform's own
// in-memory store is written in. It would also have made a whole class of
// backend unimplementable. A store that embeds server-side is handed text and a
// model name, and the vectors never cross the wire. A
// contract demanding vectors would force that backend to embed twice, or force
// the platform to hold an embedding model and a token budget for a service that
// already has both.
//
// So this contract is text in, text out. `search` takes a query string, not a
// query vector. Which model embeds it, what its context window is, and what
// gets truncated to fit are the implementation's business - which is why
// `@chatbotkit-dev/vector` needs an embedding provider's key and a
// server-embedding backend does not.
//
// What is deliberately absent: there is no `createDataset`. Datasets come into
// existence when something is put in them and stop existing when it is taken
// out, which is what both implementations already do and what the platform's
// call site has always been a no-op for.

// --- filters ---

export type VectorFilterValue = string | number | boolean

/**
 * @note this is the platform's filter language rather than any vendor's, but it
 * is deliberately the *small* one - equality and ordering on a single metadata
 * field, combined with implicit AND. Every backend worth having can express
 * that, and the platform has never asked for more. `$in`, `$or` and nested
 * paths are absent because adding them later is a contract change, while
 * removing them would be a breaking one.
 */
export type VectorFilterOperand =
  | VectorFilterValue
  | { $eq: VectorFilterValue }
  | { $ne: VectorFilterValue }
  | { $gt: number }
  | { $gte: number }
  | { $lt: number }
  | { $lte: number }

/** Matched when every entry holds. */
export type VectorFilter = Record<string, VectorFilterOperand>

// --- records ---

/**
 * A record as the platform hands it over.
 *
 * @note `text` is the record, not a description of it. There is no `values`
 * field and no way to supply one: a caller that has already embedded something
 * is a caller that has decided which model the deployment uses.
 */
export interface VectorRecordInput {
  id: string

  text: string

  /** Where the text came from - a URL, a file name. Deletable in bulk by it. */
  source?: string

  /**
   * Arbitrary metadata, filterable at search time.
   *
   * @note implementations may flatten or drop values they cannot index. The
   * platform already reduces this to scalars before it arrives.
   */
  meta?: Record<string, unknown>

  /**
   * When the record stops being retrievable, in unix **milliseconds**.
   *
   * @note milliseconds throughout this contract, because that is what
   * `Date.now()` gives the platform. Backends counting in seconds convert on
   * the way in and out, which is a conversion that used to live at the call
   * site and got written twice.
   */
  expiresAt?: number
}

export interface VectorRecord {
  id: string
  text: string
  source?: string
  meta?: Record<string, unknown>

  /** Unix milliseconds. Absent where the backend does not track it. */
  createdAt?: number
  updatedAt?: number
}

export interface VectorMatch extends VectorRecord {
  /**
   * Similarity, higher is closer.
   *
   * @note the contract does not fix a scale, and callers must not assume one.
   * Cosine similarity on normalised embeddings lands in 0..1, which is what the
   * platform's thresholds are tuned for, but a backend using inner product or
   * L2 will not agree. `minScore` is passed to the backend rather than applied
   * to the results for exactly this reason - the backend knows its own scale.
   */
  score: number
}

// --- errors ---

/**
 * @note coarser than the codes a typical store returns. One such service
 * separates `UPSERT_FAILED` from `DELETE_FAILED` from `PURGE_FAILED` from
 * `QUERY_FAILED` from `BACKEND_ERROR`; all five mean the store did not do the
 * thing, and the platform's response to each is identical.
 *
 * `EMBEDDING_FAILED` survives as its own code because it is the one failure the
 * caller can act on differently: the text was the problem, so retrying it
 * unchanged will fail again.
 */
export type VectorErrorCode =
  | 'RECORD_NOT_FOUND'
  | 'EMBEDDING_FAILED'
  | 'VECTOR_UNAVAILABLE'
  | 'NOT_AUTHORIZED'
  | 'VALIDATION_FAILED'
  | 'UNSUPPORTED_OPERATION'
  | 'UNKNOWN'

/**
 * @note an interface rather than a base class, detected structurally rather
 * than with `instanceof`, for the reasons the sandbox contract gives: the spec
 * packages hold no behaviour, and module identity across a bundle boundary is
 * not something to bet error handling on.
 */
export interface VectorErrorLike extends Error {
  /** The brand. Always `true`, present so the check is not a guess. */
  readonly vector: true

  readonly code: VectorErrorCode

  /** The underlying failure, for logs. */
  readonly detail?: string
}

// --- operations ---

/** Every operation names the dataset it works on. */
export interface VectorScope {
  /**
   * The platform's dataset id. Partitions records within the index.
   *
   * @note the only name an operation carries. Where records for it are kept -
   * a collection profile on a shared vector service, a directory, a Qdrant
   * collection - is the implementation's mapping to make.
   */
  datasetId: string
}

export interface VectorUpsertOptions extends VectorScope {
  /**
   * @note a batch, though the platform currently passes one at a time. The
   * contract takes an array because the deployment's backend accepts one and
   * an import writing ten thousand records should not be ten thousand round
   * trips - a single-record signature would have made that a contract change
   * rather than a call-site change.
   */
  records: VectorRecordInput[]
}

export interface VectorFetchOptions extends VectorScope {
  recordId: string
}

export interface VectorListOptions extends VectorScope {
  /** Opaque. Whatever the last page returned. */
  cursor?: string

  limit?: number
}

export interface VectorListResult {
  records: VectorRecord[]

  /** Absent on the last page. */
  nextCursor?: string
}

export interface VectorSearchOptions extends VectorScope {
  /** Embedded by the implementation. */
  query: string

  /** Results below this are not returned. See `score` on `VectorMatch`. */
  minScore?: number

  /** How many to return at most. */
  topK?: number

  filter?: VectorFilter

  /**
   * Dense/sparse weighting for backends doing hybrid retrieval, 0..1.
   *
   * @note advisory, like `resources` on the sandbox contract. A backend with
   * only dense retrieval ignores it rather than failing, and no caller checks
   * whether it was honoured.
   */
  alpha?: number
}

export interface VectorRemoveOptions extends VectorScope {
  recordIds: string[]
}

export interface VectorRemoveBySourceOptions extends VectorScope {
  source: string
}

// --- provider ---

export interface VectorProvider {
  /**
   * Writes records, replacing any with the same id.
   *
   * @note there is no `create` distinct from `upsert`, because there was never
   * a difference. The code this replaced had `createRecord` and `upsertRecord`
   * as two methods with byte-identical bodies.
   */
  upsert(options: VectorUpsertOptions): Promise<void>

  /**
   * @throws `RECORD_NOT_FOUND` when there is no such record, which is an
   * ordinary outcome rather than an incident - the platform turns it into a
   * 404.
   */
  fetch(options: VectorFetchOptions): Promise<VectorRecord>

  list(options: VectorListOptions): Promise<VectorListResult>

  count(options: VectorScope): Promise<number>

  /**
   * Finds records close in meaning to `query`.
   *
   * @note returns an empty array for a dataset that holds nothing, including
   * one that has never existed. A caller searching an empty dataset is the
   * normal state of a newly created one, not an error worth interrupting a
   * conversation for.
   */
  search(options: VectorSearchOptions): Promise<VectorMatch[]>

  remove(options: VectorRemoveOptions): Promise<void>

  /**
   * @note separate from `remove` rather than a union on one method, because the
   * two are different questions - "forget these" against "forget everything
   * that came from there" - and a backend may well answer them by different
   * routes. An implementation that cannot delete by source throws
   * `UNSUPPORTED_OPERATION`; it must not silently delete nothing, which reads
   * to the platform as a source that had no records.
   */
  removeBySource(options: VectorRemoveBySourceOptions): Promise<void>

  /** Empties a dataset. Succeeds on one that does not exist. */
  purge(options: VectorScope): Promise<void>

  /**
   * @note the convention every swappable module follows. See
   * packages/AGENTS.md.
   */
  assertConfigured(): Promise<void>
}

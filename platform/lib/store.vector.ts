// @note the platform's side of semantic storage.
//
// The index itself is now `@chatbotkit-dev/vector`, which pnpm resolves to
// either the file-backed default or this deployment's implementation. What is
// left here is the part that is genuinely the platform's: the `Store` shape its
// callers program against, the search defaults, and deciding which metadata is
// worth indexing.
//
// Three things left with the backend and are worth naming, because they used to
// look like platform concerns. Which collection a store resolves to, which
// model embeds it, and how many tokens that model accepts are all facts about
// whichever index is installed - the token limit in particular was a constant
// in this file naming a model this file never chose.

import type {
  VectorErrorLike,
  VectorRecord,
} from '@chatbotkit-dev/vector-spec'

import vector from '@chatbotkit-dev/vector'

import debug, { assert } from '@/lib/debug'
import { prepareMetaForEmbedding } from '@/lib/embed'
import { throwNotFound } from '@/lib/response'
import type {
  AccessRecordOptions,
  CountRecordsOptions,
  CreateDatasetOptions,
  CreateRecordOptions,
  DeleteDatasetOptions,
  DeleteRecordOptions,
  DeleteRecordsBySourceOptions,
  DeleteRecordsOptions,
  ListRecordsOptions,
  ListRecordsResult,
  SearchRecordsOptions,
  Store,
  StoreRecord,
  StoreSearchRecord,
  UpdateRecordOptions,
  UpsertRecordOptions,
} from '@/lib/store.types'

/**
 * @note structural rather than `instanceof`, because the contract brands errors
 * that way on purpose - the class lives in whichever implementation is
 * installed, and module identity across a bundle boundary is not something to
 * bet the error handling on.
 */
function isVectorError(error: unknown): error is VectorErrorLike {
  return (
    error instanceof Error &&
    (error as Partial<VectorErrorLike>).vector === true &&
    typeof (error as Partial<VectorErrorLike>).code === 'string'
  )
}

/**
 * @note the contract counts in unix milliseconds; `StoreRecord` wants `Date`.
 */
function toDate(milliseconds: number | undefined): Date | undefined {
  return milliseconds === undefined ? undefined : new Date(milliseconds)
}

function toStoreRecord(record: VectorRecord): StoreRecord {
  return {
    id: record.id,
    text: record.text,
    source: record.source,
    meta: record.meta,
    createdAt: toDate(record.createdAt),
    updatedAt: toDate(record.updatedAt),
  }
}

/**
 * @note the search defaults, stated once. These were per-store settings when
 * datasets chose between stores; every dataset now gets the defaults the
 * default store carried. A dataset that wants a different minimum score sets
 * one on its search options.
 */
const DEFAULT_MIN_SCORE = 0
const DEFAULT_MAX_RECORDS = 3
const DEFAULT_ALPHA = 0.9

/**
 * Store implementation backed by whichever vector module is installed.
 */
export class VectorServiceStore implements Store {

  /**
   * @note a no-op, and the contract has no counterpart for it. A dataset comes
   * into existence when a record is put in it, which is what every backend the
   * platform has ever had already did.
   */
  async createDataset({ datasetId }: CreateDatasetOptions): Promise<void> {
    datasetId
  }

  async deleteDataset({ datasetId }: DeleteDatasetOptions): Promise<void> {
    assert(!!datasetId, 'datasetId is required')

    await vector.purge({ datasetId })
  }

  /**
   * @note `createRecord` and `upsertRecord` were two methods with byte-identical
   * bodies, so one of them is now the other. The `Store` shape keeps both
   * because its callers do.
   */
  async createRecord(options: CreateRecordOptions): Promise<void> {
    await this.upsertRecord(options)
  }

  async updateRecord({
    datasetId,
    recordId,
    text,
    source,
    meta,
    expiresAt,
  }: UpdateRecordOptions): Promise<void> {
    assert(!!datasetId, 'datasetId is required')
    assert(!!recordId, 'recordId is required')

    // @note fetch existing record to merge values

    const existing = await this.accessRecord({ datasetId, recordId })

    text ??= existing.text
    source ??= existing.source
    meta ??= existing.meta

    await this.upsertRecord({
      datasetId,
      recordId,
      text,
      source,
      meta,
      expiresAt,
    })
  }

  async upsertRecord({
    datasetId,
    recordId,
    text,
    source,
    meta,
    expiresAt,
  }: UpsertRecordOptions): Promise<void> {
    assert(!!datasetId, 'datasetId is required')
    assert(!!recordId, 'recordId is required')

    debug('upserting record', {
      datasetId,
      recordId,
      textLength: text?.length,
    }).log('store.vector.VectorServiceStore.upsertRecord')

    await vector.upsert({
      datasetId,

      records: [
        {
          id: recordId,
          text,
          source,

          // @note flattened to scalars here rather than in the module, because
          // what is worth indexing about a record is the platform's judgement.
          // A backend should not be deciding that an array of tags becomes a
          // comma-separated string.
          meta: meta ? prepareMetaForEmbedding(meta) : undefined,

          expiresAt,
        },
      ],
    })
  }

  async deleteRecord({
    datasetId,
    recordId,
  }: DeleteRecordOptions): Promise<void> {
    assert(!!datasetId, 'datasetId is required')
    assert(!!recordId, 'recordId is required')

    await vector.remove({
      datasetId,
      recordIds: [recordId],
    })
  }

  async deleteRecords({
    datasetId,
    recordIds,
  }: DeleteRecordsOptions): Promise<void> {
    assert(!!datasetId, 'datasetId is required')

    await vector.remove({ datasetId, recordIds })
  }

  async deleteRecordsBySource({
    datasetId,
    source,
  }: DeleteRecordsBySourceOptions): Promise<void> {
    assert(!!datasetId, 'datasetId is required')
    assert(!!source, 'source is required')

    await vector.removeBySource({ datasetId, source })
  }

  async accessRecord({
    datasetId,
    recordId,
  }: AccessRecordOptions): Promise<StoreRecord> {
    assert(!!datasetId, 'datasetId is required')
    assert(!!recordId, 'recordId is required')

    try {
      return toStoreRecord(await vector.fetch({ datasetId, recordId }))
    } catch (error) {
      // @note a record that is not there is a 404 rather than an incident. This
      // is the one contract error the platform translates, because it is the
      // only one a caller of this method can do anything about.

      if (isVectorError(error) && error.code === 'RECORD_NOT_FOUND') {
        return throwNotFound(`Record not found: ${recordId}`)
      }

      throw error
    }
  }

  async listRecords({
    datasetId,
    cursor,
    limit,
  }: ListRecordsOptions): Promise<ListRecordsResult> {
    assert(!!datasetId, 'datasetId is required')

    const result = await vector.list({
      datasetId,
      cursor,
      limit,
    })

    debug('listed records', {
      recordCount: result.records.length,
      hasNextPage: !!result.nextCursor,
    }).log('store.vector.VectorServiceStore.listRecords')

    return {
      records: result.records.map(toStoreRecord),
      nextCursor: result.nextCursor,
    }
  }

  async countRecords({ datasetId }: CountRecordsOptions): Promise<number> {
    assert(!!datasetId, 'datasetId is required')

    return await vector.count({ datasetId })
  }

  async searchRecords({
    datasetId,
    search,
    minScore,
    maxRecords,
    filter,
  }: SearchRecordsOptions): Promise<StoreSearchRecord[]> {
    minScore ??= DEFAULT_MIN_SCORE
    maxRecords ??= DEFAULT_MAX_RECORDS

    assert(!!datasetId, 'datasetId is required')

    debug('searching records', {
      datasetId,
      search,
      minScore,
      maxRecords,
      filter,
    }).log('store.vector.VectorServiceStore.searchRecords')

    const matches = await vector.search({
      datasetId,
      query: search,
      minScore,
      topK: maxRecords,
      filter,
      alpha: DEFAULT_ALPHA,
    })

    debug('found matches', { matchCount: matches.length }).log(
      'store.vector.VectorServiceStore.searchRecords'
    )

    return matches.map((match) => ({
      ...toStoreRecord(match),

      score: match.score,
    }))
  }
}

/**
 * Create a VectorServiceStore.
 */
export function createVectorServiceStore(): VectorServiceStore {
  return new VectorServiceStore()
}

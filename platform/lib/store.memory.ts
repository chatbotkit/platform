import debug from '@/lib/debug'
import { prepareTextForEmbedding } from '@/lib/embed'
import { createEmbedding, getOpenAIError } from '@/lib/model.provider.openai'
import { throwNotFound } from '@/lib/response'
import type {
  SearchOptions,
  Store,
  StoreRecord,
  StoreSearchRecord,
} from '@/lib/store.types'

import { similarity } from 'ml-distance'

interface MemoryStoreRecord extends StoreRecord {
  embedding: number[]
}

/**
 * Base class for the memory store. It is the simplest store and is used for
 * testing and development purposes as well as for inline records
 */
export class MemoryStore implements Store {
  #records: Record<string, Record<string, MemoryStoreRecord>> = {}

  async createDataset({ datasetId }: { datasetId: string }): Promise<void> {
    this.#records[datasetId] = {}
  }

  async deleteDataset({ datasetId }: { datasetId: string }): Promise<void> {
    delete this.#records[datasetId]
  }

  async createRecord({
    datasetId,
    recordId,
    text,
    source,
    meta,
    expiresAt,
  }: {
    datasetId: string
    recordId: string
    text: string
    source?: string
    meta?: Record<string, unknown>
    expiresAt?: number
  }): Promise<void> {
    void expiresAt // @note expiresAt not used in memory store

    const embeddableText = prepareTextForEmbedding(text) // @todo slice the text to the max tokens

    let embedding: number[]

    try {
      embedding = await createEmbedding(embeddableText, {
        model: 'text-embedding-ada-002',
      })
    } catch (e) {
      throw getOpenAIError(e)
    }

    this.#records[datasetId][recordId] = {
      id: recordId,
      text,
      source,
      meta,
      embedding,
    }
  }

  async updateRecord({
    datasetId,
    recordId,
    text,
    source,
    meta,
    expiresAt,
  }: {
    datasetId: string
    recordId: string
    text?: string
    source?: string
    meta?: Record<string, unknown>
    expiresAt?: number
  }): Promise<void> {
    void expiresAt // @note expiresAt not used in memory store

    const record = await this.accessRecord({ datasetId, recordId })

    text ??= record.text
    source ??= record.source
    meta ??= record.meta

    const embeddableText = prepareTextForEmbedding(text)

    let embedding: number[]

    try {
      embedding = await createEmbedding(embeddableText, {
        model: 'text-embedding-ada-002',
      })
    } catch (e) {
      throw getOpenAIError(e)
    }

    this.#records[datasetId][recordId] = {
      id: recordId,
      text,
      source,
      meta,
      embedding,
    }
  }

  async upsertRecord({
    datasetId,
    recordId,
    text,
    source,
    meta,
    expiresAt,
  }: {
    datasetId: string
    recordId: string
    text: string
    source?: string
    meta?: Record<string, unknown>
    expiresAt?: number
  }): Promise<void> {
    void expiresAt // @note expiresAt not used in memory store

    const embeddableText = prepareTextForEmbedding(text)

    let embedding: number[]

    try {
      embedding = await createEmbedding(embeddableText, {
        model: 'text-embedding-ada-002',
      })
    } catch (e) {
      throw getOpenAIError(e)
    }

    this.#records[datasetId][recordId] = {
      id: recordId,
      text,
      source,
      meta,
      embedding,
    }
  }

  async deleteRecord({
    datasetId,
    recordId,
  }: {
    datasetId: string
    recordId: string
  }): Promise<void> {
    delete this.#records[datasetId][recordId]
  }

  async deleteRecords({
    datasetId,
    recordIds,
  }: {
    datasetId: string
    recordIds: string[]
  }): Promise<void> {
    for (const recordId of recordIds) {
      delete this.#records[datasetId][recordId]
    }
  }

  async deleteRecordsBySource({
    datasetId,
    source,
  }: {
    datasetId: string
    source: string
  }): Promise<void> {
    const dataset = this.#records[datasetId]

    if (!dataset) {
      return
    }

    for (const [recordId, record] of Object.entries(dataset)) {
      if (record.source === source) {
        delete dataset[recordId]
      }
    }
  }

  async accessRecord({
    datasetId,
    recordId,
  }: {
    datasetId: string
    recordId: string
  }): Promise<StoreRecord> {
    const record = this.#records[datasetId][recordId]

    if (!record) {
      return throwNotFound(`Record not found: ${recordId}`)
    }

    return record
  }

  async listRecords({
    datasetId,
    cursor,
    limit = 100,
  }: {
    datasetId: string
    cursor?: string
    limit?: number
  }): Promise<{ records: StoreRecord[]; nextCursor?: string }> {
    const dataset = this.#records[datasetId]

    if (!dataset) {
      return { records: [] }
    }

    const allRecords = Object.values(dataset)
    let startIndex = 0

    // @note cursor is the record id of the last returned record
    if (cursor) {
      const cursorIndex = allRecords.findIndex((r) => r.id === cursor)

      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1
      }
    }

    const records = allRecords.slice(startIndex, startIndex + limit)
    const nextCursor =
      startIndex + limit < allRecords.length
        ? records[records.length - 1]?.id
        : undefined

    return { records, nextCursor }
  }

  async countRecords({ datasetId }: { datasetId: string }): Promise<number> {
    const dataset = this.#records[datasetId]

    if (!dataset) {
      return 0
    }

    return Object.keys(dataset).length
  }

  async searchRecords({
    datasetId,
    search,
    minScore = 0.7,
    maxRecords = 3,
    filter,
  }: {
    datasetId: string
    search: string
  } & SearchOptions): Promise<StoreSearchRecord[]> {
    const dataset = this.#records[datasetId]

    if (!dataset) {
      return throwNotFound(`Dataset not found: ${datasetId}`)
    }

    let filterFn: (record: MemoryStoreRecord) => boolean = () => true

    if (filter) {
      filterFn = (record) => {
        return Object.entries(filter || {}).every(([key, operand]) => {
          const value = record.meta?.[key]

          if (typeof operand === 'object' && operand !== null) {
            if ('$eq' in operand && operand.$eq !== undefined) {
              return value === operand.$eq
            }

            if ('$ne' in operand && operand.$ne !== undefined) {
              return value !== operand.$ne
            }

            if ('$gt' in operand && operand.$gt !== undefined) {
              return (value as number) > (operand.$gt as number)
            }

            if ('$gte' in operand && operand.$gte !== undefined) {
              return (value as number) >= (operand.$gte as number)
            }

            if ('$lt' in operand && operand.$lt !== undefined) {
              return (value as number) < (operand.$lt as number)
            }

            if ('$lte' in operand && operand.$lte !== undefined) {
              return (value as number) <= (operand.$lte as number)
            }
          } else {
            return value === operand
          }

          return false
        })
      }
    }

    debug('creating embedding form search', { datasetId, search })

    let embedding: number[]

    try {
      embedding = await createEmbedding(prepareTextForEmbedding(search), {
        model: 'text-embedding-ada-002',
      })
    } catch (e) {
      throw getOpenAIError(e)
    }

    debug('searching for embedding', {
      datasetId,
      search,
      minScore,
      maxRecords,
      filter,
    })

    const matches = Object.values(dataset)
      .filter(filterFn)
      .map((record) => {
        return {
          ...record,

          score: similarity.cosine(embedding, record.embedding),
        }
      })

    debug('found matches', { matches })

    const filteredMatches = matches
      .filter(({ score }) => score >= minScore)
      .sort(({ score: a }, { score: b }) => b - a)

    // @note disabled because the object is huge
    // debug('end up with filtered matches', { filteredMatches })

    const selectedMatches = filteredMatches.slice(0, maxRecords)

    // @note disabled because the object is huge
    // debug('end up with selected matches', { selectedMatches })

    return selectedMatches.map(({ id, text, meta, score }) => {
      return { id, text, meta, score }
    })
  }
}

/**
 * Create a MemoryStore instance.
 */
export function createMemoryStore(): MemoryStore {
  return new MemoryStore()
}

import type { Filter } from '@/lib/store.filter'

/**
 * Represents a record stored in a dataset.
 */
export interface StoreRecord {
  id: string
  text: string
  source?: string
  meta?: Record<string, unknown>
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Represents a search result record with a relevance score.
 */
export interface StoreSearchRecord extends StoreRecord {
  score: number
}

/**
 * Options for searching records in a dataset.
 */
export interface SearchOptions {
  minScore?: number
  maxRecords?: number
  filter?: Filter
}

/**
 * Options for creating a dataset.
 */
export interface CreateDatasetOptions {
  datasetId: string
}

/**
 * Options for deleting a dataset.
 */
export interface DeleteDatasetOptions {
  datasetId: string
}

/**
 * Options for creating a record.
 */
export interface CreateRecordOptions {
  datasetId: string
  recordId: string
  text: string
  source?: string
  meta?: Record<string, unknown>
  expiresAt?: number
}

/**
 * Options for updating a record.
 */
export interface UpdateRecordOptions {
  datasetId: string
  recordId: string
  text?: string
  source?: string
  meta?: Record<string, unknown>
  expiresAt?: number
}

/**
 * Options for upserting a record.
 */
export interface UpsertRecordOptions {
  datasetId: string
  recordId: string
  text: string
  source?: string
  meta?: Record<string, unknown>
  expiresAt?: number
}

/**
 * Options for deleting a single record.
 */
export interface DeleteRecordOptions {
  datasetId: string
  recordId: string
}

/**
 * Options for deleting multiple records.
 */
export interface DeleteRecordsOptions {
  datasetId: string
  recordIds: string[]
}

/**
 * Options for deleting records by source.
 */
export interface DeleteRecordsBySourceOptions {
  datasetId: string
  source: string
}

/**
 * Options for accessing a record.
 */
export interface AccessRecordOptions {
  datasetId: string
  recordId: string
}

/**
 * Options for listing records.
 */
export interface ListRecordsOptions {
  datasetId: string
  cursor?: string
  limit?: number
}

/**
 * Result of listing records with pagination.
 */
export interface ListRecordsResult {
  records: StoreRecord[]
  nextCursor?: string
}

/**
 * Options for counting records.
 */
export interface CountRecordsOptions {
  datasetId: string
}

/**
 * Options for searching records.
 */
export interface SearchRecordsOptions extends SearchOptions {
  datasetId: string
  search: string
}

/**
 * Abstract class for all stores. A store is general mechanism for storing data
 * in datasets and records. It is the equivalent of a model to a chatbot except
 * its primary function is to store and retrieve data.
 */
export class Store {
  async createDataset({ datasetId }: CreateDatasetOptions): Promise<void> {
    datasetId

    throw new Error(`Not implemented`)
  }

  async deleteDataset({ datasetId }: DeleteDatasetOptions): Promise<void> {
    datasetId

    throw new Error(`Not implemented`)
  }

  async createRecord({
    datasetId,
    recordId,
    text,
    source,
    meta,
    expiresAt,
  }: CreateRecordOptions): Promise<void> {
    datasetId
    recordId
    text
    source
    meta
    expiresAt

    throw new Error(`Not implemented`)
  }

  async updateRecord({
    datasetId,
    recordId,
    text,
    source,
    meta,
    expiresAt,
  }: UpdateRecordOptions): Promise<void> {
    datasetId
    recordId
    text
    source
    meta
    expiresAt

    throw new Error(`Not implemented`)
  }

  async upsertRecord({
    datasetId,
    recordId,
    text,
    source,
    meta,
    expiresAt,
  }: UpsertRecordOptions): Promise<void> {
    datasetId
    recordId
    text
    source
    meta
    expiresAt

    throw new Error(`Not implemented`)
  }

  async deleteRecord({
    datasetId,
    recordId,
  }: DeleteRecordOptions): Promise<void> {
    datasetId
    recordId

    throw new Error(`Not implemented`)
  }

  async deleteRecords({
    datasetId,
    recordIds,
  }: DeleteRecordsOptions): Promise<void> {
    datasetId
    recordIds

    throw new Error(`Not implemented`)
  }

  /**
   * Delete all records with a specific source value.
   */
  async deleteRecordsBySource({
    datasetId,
    source,
  }: DeleteRecordsBySourceOptions): Promise<void> {
    datasetId
    source

    throw new Error(`Not implemented`)
  }

  async accessRecord({
    datasetId,
    recordId,
  }: AccessRecordOptions): Promise<StoreRecord> {
    datasetId
    recordId

    throw new Error(`Not implemented`)
  }

  /**
   * List records in a dataset with cursor-based pagination.
   */
  async listRecords({
    datasetId,
    cursor,
    limit,
  }: ListRecordsOptions): Promise<ListRecordsResult> {
    datasetId
    cursor
    limit

    throw new Error(`Not implemented`)
  }

  /**
   * Get the total count of records in a dataset.
   */
  async countRecords({ datasetId }: CountRecordsOptions): Promise<number> {
    datasetId

    throw new Error(`Not implemented`)
  }

  async searchRecords({
    datasetId,
    search,
  }: SearchRecordsOptions): Promise<StoreSearchRecord[]> {
    datasetId
    search

    throw new Error(`Not implemented`)
  }
}

/**
 * Get the store backing every dataset.
 *
 * @note there is exactly one - whichever vector module is installed. This used
 * to dispatch over per-dataset store names, but every name resolved to the
 * same index, so the names were retired.
 */
export async function getStore(): Promise<Store> {
  const { createVectorServiceStore } = await import('./store.vector')

  return createVectorServiceStore()
}

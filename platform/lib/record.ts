import { MAX_DB_TEXT_BYTES_LENGTH } from '@/prisma/constraints'

import debug, { assert } from '@/lib/debug'
import type { Store } from '@/lib/store.types'
import { byteSlice, normalizeText } from '@/lib/string'

import { v5 as uuidv5 } from 'uuid'

export const RECORD_ID_NAMESPACE = '5e2f3eed-689e-4597-be48-f6b4d9efca23' // @note do not change

interface CreateRecordIdOptions {
  rootId: string
  datasetId: string
  source: string
  index: number
}

/**
 * This helper method guarantees that same record will occupy the same space
 * although its content may have changed.
 */
export function createRecordId({
  rootId,
  datasetId,
  source,
  index,
}: CreateRecordIdOptions): string {
  // Do not change how t is calculated to avoid creating duplicate entries.

  const t = [datasetId, source, index].join('\n\n')

  const hash = uuidv5(t, RECORD_ID_NAMESPACE).replace(/-/g, '').toLowerCase()

  return `${rootId}-${hash}`
}

interface CreateRecordOptions {
  store: Store
  datasetId: string
  text: string
  source?: string
  recordId?: string
  meta?: Record<string, unknown>
  expiresAt?: number
}

/**
 * Note that this function does not check if the datasetId exists.
 */
export async function createRecord({
  store,
  datasetId,
  text,
  source,
  recordId,
  meta,
  expiresAt,
}: CreateRecordOptions): Promise<string> {
  assert(datasetId, 'datasetId is required')

  if (text) {
    text = normalizeText(text)
    text = byteSlice(text, 0, MAX_DB_TEXT_BYTES_LENGTH)
  }

  debug(`creating record`, {
    datasetId,
    recordId,
    text,
    source,
    meta,
  }).log('record.createRecord')

  // @note generate a record ID if not provided
  const id =
    recordId ??
    uuidv5(`${datasetId}-${Date.now()}-${Math.random()}`, RECORD_ID_NAMESPACE)
      .replace(/-/g, '')
      .toLowerCase()

  await store.createRecord({
    datasetId,
    recordId: id,
    text,
    source,
    meta,
    expiresAt,
  })

  return id
}

interface UpdateRecordOptions {
  store: Store
  datasetId: string
  recordId: string
  text: string
  source?: string
  meta?: Record<string, unknown>
  expiresAt?: number
}

/**
 * Note that this function does not check if the recordId exists.
 */
export async function updateRecord({
  store,
  datasetId,
  recordId,
  text,
  source,
  meta,
  expiresAt,
}: UpdateRecordOptions): Promise<string> {
  assert(datasetId, 'datasetId is required')
  assert(recordId, 'recordId is required')

  if (text) {
    text = normalizeText(text)
    text = byteSlice(text, 0, MAX_DB_TEXT_BYTES_LENGTH)
  }

  debug(`updating record`, {
    datasetId,
    recordId,
    text,
    source,
    meta,
  }).log('record.updateRecord')

  await store.updateRecord({
    datasetId,
    recordId,
    text,
    source,
    meta,
    expiresAt,
  })

  return recordId
}

interface UpsertRecordOptions {
  store: Store
  datasetId: string
  recordId: string
  text: string
  source?: string
  meta?: Record<string, unknown>
  expiresAt?: number
}

/**
 * Note that this function does not check if the recordId exists.
 */
export async function upsertRecord({
  store,
  datasetId,
  recordId,
  text,
  source,
  meta,
  expiresAt,
}: UpsertRecordOptions): Promise<string> {
  assert(datasetId, 'datasetId is required')
  assert(recordId, 'recordId is required')

  if (text) {
    text = normalizeText(text)
    text = byteSlice(text, 0, MAX_DB_TEXT_BYTES_LENGTH)
  }

  debug(`upserting record`, {
    datasetId,
    recordId,
    text,
    source,
    meta,
  }).log('record.upsertRecord')

  await store.upsertRecord({
    datasetId,
    recordId,
    text,
    source,
    meta,
    expiresAt,
  })

  return recordId
}

interface DeleteRecordOptions {
  store: Store
  datasetId: string
  recordId: string
}

/**
 * Note that this function does not check if the recordId exists.
 */
export async function deleteRecord({
  store,
  datasetId,
  recordId,
}: DeleteRecordOptions): Promise<void> {
  assert(datasetId, 'datasetId is required')
  assert(recordId, 'recordId is required')

  await store.deleteRecord({ datasetId, recordId })
}

interface DeleteRecordsOptions {
  store: Store
  datasetId: string
  recordIds: string[]
}

/**
 * Note that this function does not check if the recordId exists.
 */
export async function deleteRecords({
  store,
  datasetId,
  recordIds,
}: DeleteRecordsOptions): Promise<void> {
  assert(datasetId, 'datasetId is required')
  assert(recordIds, 'recordIds is required')

  await store.deleteRecords({ datasetId, recordIds })
}

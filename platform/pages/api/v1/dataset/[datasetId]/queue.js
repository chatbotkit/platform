// @ts-check
import { html2text } from '@chatbotkit-dev/file-html/parse'

import {
  maxTokens as defaultRecordMaxTokens,
  overlapTokens as defaultRecordOverlapTokens,
} from '@/config/records'

import prisma from '@/prisma/client'
import { SyncStatus } from '@/prisma/types'

import { decodeUint8Array as decodeUint8ArrayFromB64 } from '@/lib/b64'
import { chunkFile, chunkUrl } from '@/lib/chunk'
import debug, { assert } from '@/lib/debug'
import { captureInputError } from '@/lib/error'
import { getFileObjectDownloadUrl } from '@/lib/file.storage'
import it from '@/lib/it'
import { runTasks } from '@/lib/job'
import { databaseLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import { isHtmlFile } from '@/lib/mime'
import { notifyDatasetSyncCompleted } from '@/lib/notify'
import { isEmpty } from '@/lib/object'
import queue from '@/lib/queue'
import { withQueueHandlerBounded } from '@/lib/queue2'
import { createRecordId, upsertRecord } from '@/lib/record'
import { getStore } from '@/lib/store.types'
import { getRandomId } from '@/lib/string'
import { isHTTPURL } from '@/lib/url'
import { stringify as stringifyYaml } from '@/lib/yaml'
import { ungzip } from '@/lib/zlib'
import { parseAsync } from '@/lib/zod.schema'
import { timestamp as timestampType } from '@/lib/zod.types'

import { z } from 'zod'

export const STASH_RECORD_WORKERS = 10

export const CREATE_DATASET_RECORD_EVENT_TYPE = 'createDatasetRecord'
export const IMPORT_BLOB_EVENT_TYPE = 'importBlob'
export const IMPORT_FILE_EVENT_TYPE = 'importFile'
export const IMPORT_JOB_START_EVENT_TYPE = 'importJobStart'
export const IMPORT_JOB_END_EVENT_TYPE = 'importJobEnd'

/**
 * @typedef {z.infer<typeof CreateDatasetRecordPayloadSchema>} CreateDatasetRecordPayload
 */
export const CreateDatasetRecordPayloadSchema = z.object({
  text: z.string(),
  url: z.string().optional(),
  index: z.number().optional(),
  meta: z.record(z.any()).optional(),
})

/**
 * @typedef {z.infer<typeof ImportBlobPayloadSchema>} ImportBlobPayload
 */
export const ImportBlobPayloadSchema = z.object({
  dataZB64: z.string(),
  name: z.string(),
  type: z.string(),
  url: z.string().optional(),
  expiresAt: timestampType.optional(),
  meta: z.record(z.any()).optional(),
  options: z.record(z.any()).optional(),
})

/**
 * @typedef {z.infer<typeof ImportFiletPayloadSchema>} ImportFilePayload
 */
export const ImportFiletPayloadSchema = z.object({
  fileId: z.string(),
  url: z.string().optional(),
  expiresAt: timestampType.optional(),
  meta: z.record(z.any()).optional(),
  options: z.record(z.any()).optional(),
})

/**
 * @typedef {z.infer<typeof ImportJobStartPayloadSchema>} ImportJobStartPayload
 */
export const ImportJobStartPayloadSchema = z.object({
  context: z.record(z.any()).optional(),
})

/**
 * @typedef {z.infer<typeof ImportJobEndPayloadSchema>} ImportJobEndPayload
 */
export const ImportJobEndPayloadSchema = z.object({
  context: z.record(z.any()).optional(),
  urls: z.array(z.string()).optional(),
})

/**
 * @typedef {import('@/prisma/types').Dataset & {user: import('@/prisma/types').User}} Dataset
 */

/**
 * @param {{
 *   dataset: Dataset,
 *   text: string,
 *   source: string,
 *   index: number,
 *   meta?: Record<string,any>,
 *   expiresAt?: number
 * }} options
 * @returns {Promise<void>}
 */
async function stashRecord({ dataset, text, source, index, meta, expiresAt }) {
  debug(`stashing record`, {
    datasetId: dataset.id,
    text,
    source,
    index,
    meta,
    expiresAt,
  }).log('dataset.instance.queue.stashRecord')

  text = text.trim()

  assert(!!text, 'unexpected empty text')
  assert(text !== '[object Object]', 'unexpected serialized object')

  const recordId = createRecordId({
    rootId: dataset.id,
    datasetId: dataset.id,
    source,
    index,
  })

  const store = await getStore()

  await upsertRecord({
    store: store,

    datasetId: dataset.id,

    recordId,

    text,

    source,

    meta: meta,

    expiresAt,
  })

  debug(`record stashing completed`).log('dataset.instance.queue.stashRecord')
}

/**
 * @param {{
 *   dataset: Dataset,
 *   items: {text: string, meta?: Record<string,any>}[],
 *   source: string,
 *   meta?: Record<string,any>,
 *   expiresAt?: number
 * }} options
 * @returns {Promise<void>}
 */
async function importItems({ dataset, items, source, meta, expiresAt }) {
  debug(`importing items`, {
    datasetId: dataset.id,
    items,
    source,
    meta,
    expiresAt,
  }).log('dataset.instance.queue.importItems')

  // @note if there are no items but there is meta then record the meta as an
  // item - this could happen when the notion integration sync databases that
  // do not have any content for example
  {
    if (items.length === 0 && meta && !isEmpty(meta)) {
      items = [
        {
          text: stringifyYaml(meta),
        },
      ]
    }
  }

  let index = 0

  await runTasks(
    Array(STASH_RECORD_WORKERS)
      .fill(it(items))
      .map(async (items) => {
        for await (const item of items) {
          // @note skip items with empty or whitespace-only text to avoid
          // assertion errors - this can happen when html2text extracts content
          // from pages with only navigation, headers, footers that are filtered

          const trimmedText = item.text?.trim()

          if (!trimmedText) {
            continue
          }

          await stashRecord({
            dataset,
            text: trimmedText,
            source,
            index: index++,
            meta: {
              ...(Object.keys(item.meta || {}).length
                ? {
                    item: {
                      ...item.meta,
                    },
                  }
                : undefined),

              ...meta,
            },
            expiresAt,
          })
        }
      })
  )

  debug(`importing items completed`, { records: index }).log(
    'dataset.instance.queue.importItems'
  )
}

/**
 * @param {{
 *   dataset: Dataset,
 *   blob: Blob,
 *   source: string,
 *   meta?: Record<string,any>,
 *   options?: Record<string,any>,
 *   expiresAt?: number
 * }} options
 * @returns {Promise<void>}
 */
export async function splitImportBlob({
  dataset,
  blob,
  source,
  meta,
  options,
  expiresAt,
}) {
  debug(`split importing blob`, {
    datasetId: dataset.id,
    source,
    meta,
    expiresAt,
  }).log('dataset.instance.queue.splitImportBlob')

  const recordMaxTokens = dataset.recordMaxTokens || defaultRecordMaxTokens
  const recordOverlapTokens = defaultRecordOverlapTokens

  // @note we treat empty string as null and we do not trim or filter
  // deliberately because we want to use the upstream defaults

  let separators = dataset.separators
    ? dataset.separators.split(',')
    : undefined

  // @note however when the separators is an array with a single empty string
  // we treat it as undefined

  if (separators?.length === 1 && separators[0] === '') {
    separators = undefined
  }

  // @note we need to do special handling for blobs that have relative
  // references such as html files and source that is an http(s) url
  {
    switch (true) {
      // @note this condition is technically no longer needed because we have
      // now resolve all urls in the crawler before being passed here
      // @todo decide weather we need to keep this condition or remove it
      // @note we decide to remove this then we need to pass on the selectors
      // in order to extract the right content
      // @note actually this use here is now required because in the case of the
      // sitemap we need to use the selectors to extract the right content - it
      // needs to stay until we have this feature built into the runner

      case isHtmlFile(blob) && isHTTPURL(source): {
        const html = await blob.text()

        const text = html2text(html, {
          url: source,
          selectors: options?.selectors,
        })

        blob = new Blob([text], { type: 'text/plain' })

        break
      }
    }
  }

  if (!blob.size) {
    debug(`aborting due to empty blob`).log(
      'dataset.instance.queue.splitImportBlob'
    )

    return
  }

  const { items } = await chunkFile(blob, {
    userId: dataset.userId,

    size: recordMaxTokens,
    overlap: recordOverlapTokens,

    separators: separators?.length ? separators : undefined,
  })

  await importItems({
    dataset,
    items,
    source,
    meta: {
      ...meta,
    },
    expiresAt,
  })
}

/**
 * @param {{
 *   dataset: Dataset,
 *   fileId: string,
 *   source: string,
 *   meta?: Record<string,any>,
 *   expiresAt?: number
 * }} options
 * @returns {Promise<void>}
 */
export async function splitImportFile({
  dataset,
  fileId,
  source,
  meta,
  expiresAt,
}) {
  debug(`split importing file`, {
    datasetId: dataset.id,
    source,
    meta,
    expiresAt,
  }).log('dataset.instance.queue.splitImportFile')

  const recordMaxTokens = dataset.recordMaxTokens || defaultRecordMaxTokens
  const recordOverlapTokens = defaultRecordOverlapTokens

  const url = await getFileObjectDownloadUrl(fileId)

  // @note we treat empty string as null and we do not trim or filter
  // deliberately because we want to use the upstream defaults

  let separators = dataset.separators
    ? dataset.separators.split(',')
    : undefined

  // @note however when the separators is an array with a single empty string
  // we treat it as undefined

  if (separators?.length === 1 && separators[0] === '') {
    separators = undefined
  }

  const { items } = await chunkUrl({
    url: url,

    userId: dataset.userId,

    size: recordMaxTokens,
    overlap: recordOverlapTokens,

    separators: separators?.length ? separators : undefined,
  })

  await importItems({
    dataset,
    items,
    source,
    meta: {
      ...meta,
    },
    expiresAt,
  })
}

/**
 * @template T
 * @param {(dataset: Dataset, payload: T) => Promise<void>} fn
 * @returns {(datasetId: string, payload: T) => Promise<void>}
 */
export function withDatasetAndLimits(fn) {
  return async function (datasetId, payload) {
    debug(`handling payload`, { datasetId, payload }).log(
      'dataset.instance.queue.withDatasetAndLimits'
    )

    const dataset = await prisma.dataset.findUnique({
      where: {
        id: datasetId,
      },

      include: {
        user: true,
      },
    })

    if (!dataset) {
      // @note We stop silently if dataset is not found. This can happen when
      // the dataset was deleted before the event was processed.

      debug(`aborting due to missing dataset`).log(
        'dataset.instance.queue.withDatasetAndLimits'
      )

      return
    }

    if (!(await databaseLimitsOk(dataset.user, ['database/record']))) {
      debug(`aborting due to exceeded limits`).log(
        'dataset.instance.queue.withDatasetAndLimits'
      )

      return
    }

    await fn(dataset, payload)

    debug(`payload handling completed`).log(
      'dataset.instance.queue.withDatasetAndLimits'
    )
  }
}

/**
 * @typedef {{
 *   type: typeof CREATE_DATASET_RECORD_EVENT_TYPE,
 *   payload: CreateDatasetRecordPayload
 * }} CreateDatasetRecordEvent
 */
export const handleCreateDatasetRecordEvent = withDatasetAndLimits(
  /**
   * @param {Dataset} dataset
   * @param {CreateDatasetRecordPayload} payload
   * @returns {Promise<void>}
   */
  async function (dataset, payload) {
    debug(`handling create dataset record event`, {
      datasetId: dataset.id,
      payload,
    }).log('dataset.instance.queue.handleCreateDatasetRecordEvent')

    const {
      text,

      url = `file:///tmp/${getRandomId()}`,

      index = 0,

      meta = undefined,
    } = payload

    await stashRecord({ dataset, text, source: url, index, meta })
  }
)

/**
 * @typedef {{
 *   type: typeof IMPORT_BLOB_EVENT_TYPE,
 *   payload: ImportBlobPayload
 * }} ImportBlobEvent
 */
export const handleImportBlobEvent = withDatasetAndLimits(
  /**
   * @param {Dataset} dataset
   * @param {ImportBlobPayload} payload
   * @returns {Promise<void>}
   */
  async function (dataset, payload) {
    debug(`handling import blob event`, {
      datasetId: dataset.id,
      payload,
    }).log('dataset.instance.queue.handleImportBlobEvent')

    const {
      dataZB64,

      name,
      type,

      url = `blob:///${encodeURIComponent(name || getRandomId())}`,

      expiresAt,

      meta = {},

      options = {},
    } = payload

    const data = await ungzip(await decodeUint8ArrayFromB64(dataZB64))

    const blob = new Blob([new Uint8Array(data)], { type })

    await splitImportBlob({
      dataset,
      blob,
      source: url,
      meta,
      options,
      expiresAt,
    })
  }
)

/**
 * @typedef {{
 *   type: typeof IMPORT_FILE_EVENT_TYPE,
 *   payload: ImportFilePayload
 * }} ImportFileEvent
 */
export const handleImportFileEvent = withDatasetAndLimits(
  /**
   * @param {Dataset} dataset
   * @param {ImportFilePayload} payload
   * @returns {Promise<void>}
   */
  async function (dataset, payload) {
    debug(`handling import file event`, {
      datasetId: dataset.id,
      payload,
    }).log('dataset.instance.queue.handleImportFileEvent')

    const {
      fileId,

      url = `file:///${fileId}`,

      expiresAt,

      meta = {},
    } = payload

    const file = await prisma.file.findUnique({
      where: {
        id: fileId,
      },
    })

    if (!file) {
      // @note We stop silently if file is not found. This can happen when the
      // file was deleted before the event was processed.

      debug(`aborting due to missing file`).log(
        'dataset.instance.queue.handleImportFileEvent'
      )

      return
    }

    await splitImportFile({
      dataset,
      fileId,
      source: url,
      meta,
      expiresAt,
    })
  }
)

/**
 * @typedef {{
 *   type: typeof IMPORT_JOB_START_EVENT_TYPE,
 *   payload: ImportJobStartPayload
 * }} ImportJobStartEvent
 */
export const handleImportJobStartEvent = withDatasetAndLimits(
  /**
   * @param {Dataset} dataset
   * @param {ImportJobStartPayload} payload
   */
  async function (dataset, payload) {
    debug(`handling import job start event`, {
      datasetId: dataset.id,
      payload,
    }).log('dataset.instance.queue.handleImportJobStartEvent')

    const { context } = payload

    await logEvent({
      user: { id: dataset.userId },
      type: 'dataset.import.job.start',
      relations: {
        blueprintId: dataset.blueprintId,
        datasetId: dataset.id,
      },
      meta: {
        context,
      },
    })
  }
)

/**
 * @typedef {{
 *   type: typeof IMPORT_JOB_END_EVENT_TYPE,
 *   payload: ImportJobEndPayload
 * }} ImportJobEndEvent
 */
export const handleImportJobEndEvent = withDatasetAndLimits(
  /**
   * @param {Dataset} dataset
   * @param {ImportJobEndPayload} payload
   */
  async function (dataset, payload) {
    debug(`handling import job end event`, {
      datasetId: dataset.id,
      payload,
    }).log('dataset.instance.queue.handleImportJobEndEvent')

    const { context, urls } = payload

    // @note update integration sync status to synced when job completes
    // @todo generalize this so that each integration can handle this itself
    {
      if (context?.sitemapIntegrationId) {
        await prisma.sitemapIntegration.update({
          where: { id: context.sitemapIntegrationId },
          data: { syncStatus: SyncStatus.synced, lastSyncedAt: new Date() },
        })
      }

      if (context?.notionIntegrationId) {
        await prisma.notionIntegration.update({
          where: { id: context.notionIntegrationId },
          data: { syncStatus: SyncStatus.synced, lastSyncedAt: new Date() },
        })
      }
    }

    await logEvent({
      user: dataset.user,
      type: 'dataset.import.job.finish',
      relations: {
        blueprintId: dataset.blueprintId,
        datasetId: dataset.id,
        sitemapIntegrationId: context?.sitemapIntegrationId,
        notionIntegrationId: context?.notionIntegrationId,
      },
      meta: {
        context,
        urls,
      },
    })

    await notifyDatasetSyncCompleted(dataset.user, dataset.id, urls)
  }
)

/**
 * @param {string} datasetId
 * @param {CreateDatasetRecordEvent|ImportBlobEvent|ImportFileEvent|ImportJobStartEvent|ImportJobEndEvent} event
 * @returns {Promise<void>}
 */
export async function sendEvent(datasetId, event) {
  switch (true) {
    case event.type === CREATE_DATASET_RECORD_EVENT_TYPE: {
      await parseAsync(
        CreateDatasetRecordPayloadSchema,
        event.payload,
        captureInputError
      )

      break
    }

    case event.type === IMPORT_BLOB_EVENT_TYPE: {
      await parseAsync(
        ImportBlobPayloadSchema,
        event.payload,
        captureInputError
      )

      break
    }

    case event.type === IMPORT_FILE_EVENT_TYPE: {
      await parseAsync(
        ImportFiletPayloadSchema,
        event.payload,
        captureInputError
      )

      break
    }

    case event.type === IMPORT_JOB_START_EVENT_TYPE: {
      await parseAsync(
        ImportJobStartPayloadSchema,
        event.payload,
        captureInputError
      )

      break
    }

    case event.type === IMPORT_JOB_END_EVENT_TYPE: {
      await parseAsync(
        ImportJobEndPayloadSchema,
        event.payload,
        captureInputError
      )

      break
    }
  }

  await queue(`/api/v1/dataset/${datasetId}/queue`, event)
}

/**
 */
export default withQueueHandlerBounded('datasetId', {
  [CREATE_DATASET_RECORD_EVENT_TYPE]: {
    handler: handleCreateDatasetRecordEvent,
    schema: CreateDatasetRecordPayloadSchema,
  },
  [IMPORT_BLOB_EVENT_TYPE]: {
    handler: handleImportBlobEvent,
    schema: ImportBlobPayloadSchema,
  },
  [IMPORT_FILE_EVENT_TYPE]: {
    handler: handleImportFileEvent,
    schema: ImportFiletPayloadSchema,
  },
  [IMPORT_JOB_START_EVENT_TYPE]: {
    handler: handleImportJobStartEvent,
    schema: ImportJobStartPayloadSchema,
  },
  [IMPORT_JOB_END_EVENT_TYPE]: {
    handler: handleImportJobEndEvent,
    schema: ImportJobEndPayloadSchema,
  },
})

// @note do not generate manuals or docs for this internal endpoint

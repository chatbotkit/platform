import { slice } from '@chatbotkit-dev/gpt'

import datasetsConfig from '@/config/datasets'
import { baseLanguageModel } from '@/config/models'
import {
  maxSearchRecords as defaultMaxSearchRecords,
  maxTokens as defaultRecordMaxTokens,
} from '@/config/records'

import type { Dataset } from '@/prisma/types'
import { MessageType } from '@/prisma/types'

import type { Sink } from '@/lib/conversation.tag'
import { searchDataset } from '@/lib/dataset.search'
import debug from '@/lib/debug'
import { captureException } from '@/lib/error'
import { TimeoutError } from '@/lib/fetch'
import type { DatasetMeta } from '@/lib/meta'
import { omit } from '@/lib/object'
import type { StoreSearchRecord } from '@/lib/store.types'
import {
  anyNonEmptyString,
  getRandomId,
  joinTrimmedNotEmpty,
  replaceWithMap,
} from '@/lib/string'
import { isURL } from '@/lib/url'

export const TEXT_MIN_LENGTH_THRESHOLD = 3

export const RECORD_JOINER = '\n\n---\n\n'

export const MATCH_INSTRUCTION_JOINER = '\n\n---\n\n'
export const MISMATCH_INSTRUCTION_JOINER = '\n\n---\n\n'

export const DATASET_SEARCH_BEGIN_TAG = 'datasetSearchBegin'
export const DATASET_SEARCH_END_TAG = 'datasetSearchEnd'

interface Message {
  type: MessageType
  text: string
  meta?: Record<string, unknown>
}

interface RecordItem {
  text: string
  meta?: Record<string, unknown>
}

interface ApplyDatasetOptions {
  sink?: Sink
  messages?: Message[]
  usageMeta?: Record<string, unknown>
  substitutions?: Record<string, string>
  debug?: boolean
}

interface ApplyDatasetResult {
  usage: { token: number; model: string }
  error?: string
  result?: {
    search: string
    instructions: {
      match: {
        description: string
        instruction: string
      }
      mismatch: {
        description: string
        instruction: string
      }
    }
    records: Array<{
      text: string
      source?: string
      meta: Record<string, unknown>
    }>
  } | null
  messages: Message[]
  meta?: DatasetMeta
}

/**
 * Converts an array of records to a formatted text string.
 */
export function recordsToText(records: RecordItem[]): string {
  return joinTrimmedNotEmpty(
    records.map(({ text, meta }) => {
      if (!text) {
        return text
      }

      // @todo inclusion of metadata fields should be configurable

      const lines: string[] = []

      if (meta) {
        ;['Source', 'URL', 'Title', 'Date'].forEach((name) => {
          ;[name, name.toLowerCase()].forEach((key) => {
            if (meta[key]) {
              lines.push(`${name}: ${meta[key]}`)
            }
          })
        })
      }

      return joinTrimmedNotEmpty([lines.join('\n'), `...${text}...`], '\n\n')
    }),
    RECORD_JOINER
  )
}

/**
 * Generates the match instruction text for a dataset search.
 */
export function matchInstructionToText(
  search: string,
  dataset: Dataset
): string {
  const mi = anyNonEmptyString(
    dataset.matchInstruction,
    datasetsConfig.defaultMatchInstruction
  )

  return mi !== '-' ? replaceWithMap(mi || '', { '{search}': search }) : mi
}

/**
 * Generates the mismatch instruction text for a dataset search.
 */
export function mismatchInstructionToText(
  search: string,
  dataset: Dataset
): string {
  const msi = anyNonEmptyString(
    dataset.mismatchInstruction,
    datasetsConfig.defaultMismatchInstruction
  )

  return msi !== '-' ? replaceWithMap(msi || '', { '{search}': search }) : msi
}

/**
 * Applies a dataset search to generate context messages for the conversation.
 *
 * @todo use options.sink to report progress
 */
export async function applyDataset(
  userId: string,
  dataset: Dataset,
  search: string,
  options?: ApplyDatasetOptions
): Promise<ApplyDatasetResult> {
  debug(`apply dataset`, { userId, dataset, search, options }).log(
    'dataset.apply.applyDataset'
  )

  if (search.length < TEXT_MIN_LENGTH_THRESHOLD) {
    debug('skip dataset application due to text length size').log(
      'dataset.apply.applyDataset'
    )

    return {
      usage: { token: 0, model: baseLanguageModel },

      result: null,

      messages: [],
    }
  }

  const { sink } = options || {}

  debug('looking up dataset').log('dataset.apply.applyDataset')

  const recordMaxTokens = dataset.recordMaxTokens || defaultRecordMaxTokens

  const maxRecords = dataset.searchMaxRecords || defaultMaxSearchRecords
  const maxTokens = dataset.searchMaxTokens || recordMaxTokens * maxRecords

  const tagId = getRandomId('search-')

  await sink?.push(DATASET_SEARCH_BEGIN_TAG, { id: tagId, search })

  let records: StoreSearchRecord[]

  try {
    records = await searchDataset(userId, dataset, search)
  } catch (e) {
    // @note the dataset search hits the external vector service over the
    // network (see store.vector.ts). A slow or unreachable service surfaces as
    // a TimeoutError. We must not let it propagate out of the conversation
    // receive path - degrade gracefully so the bot can still reply, and report
    // the failure so it remains visible.

    await captureException(e)

    debug('dataset search failed', { e }).log('dataset.apply.applyDataset')

    // close the search tag we opened above so the UI does not hang on a
    // perpetual "searching" state

    await sink?.push(DATASET_SEARCH_END_TAG, { id: tagId, search, records: [] })

    // @note we return the error and leave result undefined so the caller's
    // `result = error ? { error } : undefined` default surfaces it to the model
    // - this mirrors how applySkillset reports a failed action

    return {
      usage: { token: 0, model: baseLanguageModel },

      error:
        e instanceof TimeoutError
          ? 'The knowledge base search timed out. Please try again shortly.'
          : 'The knowledge base search failed.',

      messages: [],
    }
  }

  debug('found records', { records }).log('dataset.apply.applyDataset')

  const messages: Message[] = []

  // @note we need to return the score into the message meta - this is a
  // requirement from intelliway

  // @todo come up with a more standard way to expose information about the
  // records that we identified without using the meta - perhaps a more standard
  // way to query and understand this information

  if (records.length) {
    messages.push({
      type: MessageType.context,

      text: joinTrimmedNotEmpty(
        [
          // match instruction

          matchInstructionToText(search, dataset),

          // found records

          slice(recordsToText(records), 0, maxTokens),

          // question

          `Question: ${search}`,
        ],
        MATCH_INSTRUCTION_JOINER
      ),

      meta: {
        dataset: {
          id: dataset.id,
          action: {
            name: 'query',
            input: search,
            result: {
              records: records.map(({ id, score }) => ({ id, score })),
            },
          },
        },
      } satisfies DatasetMeta,
    })
  }

  if (!messages.length) {
    messages.push({
      type: MessageType.context,

      text: joinTrimmedNotEmpty(
        [
          // mismatch instruction

          mismatchInstructionToText(search, dataset),

          // found records

          // -none

          // question

          `Question: ${search}`,
        ],
        MISMATCH_INSTRUCTION_JOINER
      ),

      meta: {
        dataset: {
          id: dataset.id,
          action: {
            name: 'query',
            input: search,
            result: {
              records: records.map(({ id, score }) => ({ id, score })),
            },
          },
        },
      } satisfies DatasetMeta,
    })
  }

  await sink?.push(DATASET_SEARCH_END_TAG, {
    id: tagId,

    search,

    records: [
      // @todo provide an option to indicate if the caller's preference is to
      // return dataset records in order to avoid returning too much data

      ...records
        .filter(({ source }) => source && isURL(source))
        .map(({ source, text }) => ({ source, text })),
    ],
  })

  const ret: ApplyDatasetResult = {
    usage: {
      token: 0,
      model: baseLanguageModel,
    },

    error: undefined,

    result: {
      search,

      instructions: {
        match: {
          description: 'Use when there are records matching the search',
          instruction: matchInstructionToText(search, dataset),
        },
        mismatch: {
          description: 'Use when there are no records matching the search',
          instruction: mismatchInstructionToText(search, dataset),
        },
      },

      records: records
        // @note it is important to return only the text and meta field to avoid
        // wasting tokens and causing unnecessary confusions
        .map(({ text, source, meta }) => ({
          text,
          source,
          // @note from the meta fields we should remove fields that start
          // with _ and not useful fields such as: source, fileId
          meta: omit(meta || {}, [
            /^_/,
            'source',
            'integration',
            'fileId',
            /IntegrationId$/,
          ]),
        })),
    },

    messages,

    meta: {
      dataset: {
        id: dataset.id,
        action: {
          name: 'query',
          input: search,
          result: {
            records: records.map(({ id, score }) => ({ id, score })),
          },
        },
      },
    } satisfies DatasetMeta,
  }

  debug('dataset application result', { ret }).log('dataset.apply.applyDataset')

  return ret
}

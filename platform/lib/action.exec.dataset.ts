import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { defaultRerankModel } from '@/config/models'

import prisma from '@/prisma/client'
import type { Dataset } from '@/prisma/types'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import { canUseDataset } from '@/lib/dataset.access'
import { type DatasetFilter, DatasetFilterSchema } from '@/lib/dataset.filter'
import { searchDataset } from '@/lib/dataset.search'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import { logEvent } from '@/lib/log'
import { getCaseInsensitive } from '@/lib/object'
import { createRecord, deleteRecord } from '@/lib/record'
import { type Store, getStore } from '@/lib/store.types'
import schema from '@/lib/zod.handler'
import { z } from '@/lib/zod.schema'

import descriptionSchema from '@/schemas/description'
import nameSchema from '@/schemas/name'

// @see data/abilities/catalogue/cbk.dataset.ts for ability definitions related
// to these schemas

// @note operation name constants for compile-time validation in action.tags.ts
export const DATASET_LIST_OPERATION_NAME = 'list'
export const DATASET_CREATE_OPERATION_NAME = 'create'
export const DATASET_SEARCH_OPERATION_NAME = 'search'
export const DATASET_RECORD_CREATE_OPERATION_NAME = 'record/create'
export const DATASET_RECORD_DELETE_OPERATION_NAME = 'record/delete'

interface DoDatasetListParams {
  input: string
  params: ActionParams
  options: ActionOptions
}

export async function doDatasetList({
  input,
  params,
  options,
}: DoDatasetListParams): Promise<ActionReturn> {
  debug(`do dataset list`, { input, options })

  await logEvent({
    user: { id: options.userId },
    type: 'action.dataset.list',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const { order = 'desc', take = 10 } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: z.object({
      order: schema.enum(['asc', 'desc']).optional(),
      take: schema.number().int().min(1).max(100).optional(),
    }),
    options,
  })

  debug(`using`, { order, take })

  const datasets = await prisma.dataset.findMany({
    where: {
      userId: options.userId,
    },

    select: {
      id: true,

      name: true,
      description: true,

      meta: true,

      createdAt: true,
    },

    orderBy: {
      createdAt: order,
    },

    take,
  })

  return {
    result: {
      items: datasets,
      hasMore: datasets.length === take,
      cursor: datasets.length > 0 ? datasets[datasets.length - 1].id : null,
    },
    messages: [],
  }
}

interface DoDatasetCreateParams {
  input: string
  params: ActionParams
  options: ActionOptions
}

export async function doDatasetCreate({
  input,
  params,
  options,
}: DoDatasetCreateParams): Promise<ActionReturn> {
  debug(`do dataset create`, { input, options })

  await logEvent({
    user: { id: options.userId },
    type: 'action.dataset.create',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const { name, description } = getConfigBySchema({
    input,
    params,
    initial: {
      name: input,
    },
    schema: z.object({
      name: schema
        .string()
        .optional()
        .refine((value) => {
          try {
            nameSchema.validate(value)

            return true
          } catch {
            return false
          }
        }),
      description: schema
        .string()
        .optional()
        .refine((value) => {
          try {
            descriptionSchema.validate(value)

            return true
          } catch {
            return false
          }
        }),
    }),
    options,
  })

  const reranker = defaultRerankModel

  debug(`using`, { name, description, reranker })

  const { id } = await prisma.dataset.create({
    data: {
      userId: options.userId,

      name,
      description,

      reranker,

      // @todo add the contact?
    },
  })

  const storeClass = await getStore()

  await storeClass.createDataset({ datasetId: id })

  return {
    result: { id },
    messages: [],
  }
}

interface DoDatasetSearchParams {
  dataset: Dataset
  input: string
  params: ActionParams
  options: ActionOptions
}

export async function doDatasetSearch({
  dataset,
  input,
  params,
  options,
}: DoDatasetSearchParams): Promise<ActionReturn> {
  debug(`do dataset search`, { dataset, input, options })

  await logEvent({
    user: { id: options.userId },
    type: 'action.dataset.search',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const {
    search,
    query = search,
    text = query,
    filter,
  } = getConfigBySchema({
    input,
    params,
    initial: {
      text: input,
    },
    schema: schema.object({
      search: schema.string().optional(),
      query: schema.string().optional(),
      text: schema.string().optional(),
      filter: DatasetFilterSchema.optional(),
    }),
    options,
  })

  if (!text) {
    throw new UserInputError(`Missing 'text' parameter`)
  }

  debug(`using`, { search, query, text, filter })

  const result = await searchDataset(
    options.userId,
    dataset,
    text,
    filter as DatasetFilter | undefined
  )

  debug(`using result`, { result })

  return {
    result: result.map(({ text }) => text),
    messages: [],
  }
}

interface DoDatasetRecordCreateParams {
  dataset: Dataset
  input: string
  params: ActionParams
  options: ActionOptions
}

export async function doDatasetRecordCreate({
  dataset,
  input,
  params,
  options,
}: DoDatasetRecordCreateParams): Promise<ActionReturn> {
  debug(`do dataset record create`, { dataset, input, options })

  await logEvent({
    user: { id: options.userId },
    type: 'action.dataset.record.create',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const { text } = getConfigBySchema({
    input,
    params,
    initial: {
      text: input,
    },
    schema: schema.object({
      text: schema.string(),
    }),
    options,
  })

  if (!text) {
    throw new UserInputError(`Missing 'text' parameter`)
  }

  debug(`using`, { text })

  const store = (await getStore()) as Store

  const result = await createRecord({
    store: store,
    datasetId: dataset.id,
    text: text,
  })

  debug(`using result`, { result })

  return {
    result: result,
    messages: [],
  }
}

interface DoDatasetRecordDeleteParams {
  dataset: Dataset
  input: string
  params: ActionParams
  options: ActionOptions
}

export async function doDatasetRecordDelete({
  dataset,
  input,
  params,
  options,
}: DoDatasetRecordDeleteParams): Promise<ActionReturn> {
  debug(`do dataset record delete`, { dataset, input, options })

  await logEvent({
    user: { id: options.userId },
    type: 'action.dataset.record.delete',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: {
      params,
    },
  })

  const { recordId } = getConfigBySchema({
    input,
    params,
    initial: {},
    schema: schema.object({
      recordId: schema.string().optional(),
    }),
    options,
  })

  if (!recordId) {
    throw new UserInputError(`Missing 'recordId' parameter`)
  }

  debug(`using`, { recordId })

  const store = (await getStore()) as Store

  await deleteRecord({
    store: store,
    datasetId: dataset.id,
    recordId: recordId,
  })

  debug(`record deleted successfully`)

  return {
    result: { id: recordId },
    messages: [],
  }
}

/**
 * Executes a dataset action on a specific dataset. This action is used to
 * apply a dataset to a specific input.
 */
export async function executeDatasetAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`execute dataset action`, { input, params, options })

  let operation:
    | typeof DATASET_LIST_OPERATION_NAME
    | typeof DATASET_CREATE_OPERATION_NAME
    | typeof DATASET_SEARCH_OPERATION_NAME
    | typeof DATASET_RECORD_CREATE_OPERATION_NAME
    | typeof DATASET_RECORD_DELETE_OPERATION_NAME

  {
    switch (true) {
      case 'list' in params: {
        operation = DATASET_LIST_OPERATION_NAME

        break
      }

      case 'create' in params && !('record' in params): {
        operation = DATASET_CREATE_OPERATION_NAME

        break
      }

      case 'search' in params: {
        operation = DATASET_SEARCH_OPERATION_NAME

        break
      }

      case 'record' in params && 'create' in params: {
        operation = DATASET_RECORD_CREATE_OPERATION_NAME

        break
      }

      case 'record' in params && 'delete' in params: {
        operation = DATASET_RECORD_DELETE_OPERATION_NAME

        break
      }

      default: {
        throw new UserInputError(`Unknown operation`)
      }
    }
  }

  if (operation === DATASET_LIST_OPERATION_NAME) {
    return await doDatasetList({
      input,
      params,
      options,
    })
  }

  if (operation === DATASET_CREATE_OPERATION_NAME) {
    return await doDatasetCreate({
      input,
      params,
      options,
    })
  }

  // @note use all possible names
  // @todo use a fuzzy name match

  const datasetId =
    getCaseInsensitive(params, 'datasetId') || getCaseInsensitive(params, 'id')

  if (!datasetId) {
    throw new UserInputError(`Missing 'datasetId' parameter`)
  }

  const dataset = await prisma.dataset.findUniqueByIdentifier(
    { id: options.userId },
    datasetId
  )

  if (!dataset) {
    throw new UserInputError(`Dataset not found`)
  }

  if ((await canUseDataset(options.userId, dataset)) === false) {
    throw new UserInputError(`Cannot use dataset`)
  }

  let response: ActionReturn

  switch (operation) {
    case DATASET_SEARCH_OPERATION_NAME: {
      response = await doDatasetSearch({ dataset, input, params, options })

      break
    }

    case DATASET_RECORD_CREATE_OPERATION_NAME: {
      response = await doDatasetRecordCreate({
        dataset,
        input,
        params,
        options,
      })

      break
    }

    case DATASET_RECORD_DELETE_OPERATION_NAME: {
      response = await doDatasetRecordDelete({
        dataset,
        input,
        params,
        options,
      })

      break
    }

    default: {
      assertUnreachable(operation)
    }
  }

  return response
}

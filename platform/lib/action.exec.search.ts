import searchEngine from '@chatbotkit-dev/searchengine'

import prisma from '@/prisma/client'

import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import { canUseDataset } from '@/lib/dataset.access'
import { applyDataset } from '@/lib/dataset.apply'
import debug from '@/lib/debug'
import { UserInputError } from '@/lib/error'
import { logEvent } from '@/lib/log'
import { getCaseInsensitive } from '@/lib/object'
import { z } from '@/lib/zod.schema'

// @todo translate data/abilities/catalogue/cbk.search.yaml to ts

/**
 * A result as this action hands it to the model.
 *
 * @note narrower than the search engine's own `SearchResult`, because the
 * caller chooses how much of each result to spend tokens on.
 */
interface SearchResultItem {
  link: string
  title: string
  source?: string
  description?: string
  image?: string
}

/**
 * Executes a dataset search action. This action is used to search a dataset
 * for a specific query.
 */
export async function executeSearchAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`search`, { input, params, options })

  // dataset search
  {
    // @note use all possible names
    // @todo use a fuzzy name match

    const datasetId =
      getCaseInsensitive(params, 'datasetId') ||
      getCaseInsensitive(params, 'id')

    if (datasetId) {
      await logEvent({
        user: { id: options.userId },
        type: 'action.search.dataset',
        relations: {
          blueprintId: options.contextResources?.blueprintId,
          skillsetId: options.contextResources?.skillsetId,
          abilityId: options.contextResources?.abilityId,
        },
        meta: {
          params,
        },
      })

      const dataset = await prisma.dataset.findUnique({
        where: {
          id: datasetId,
        },
      })

      if (!dataset) {
        throw new UserInputError(`Dataset not found`)
      }

      if ((await canUseDataset(options.userId, dataset)) === false) {
        throw new UserInputError(`Cannot use dataset`)
      }

      const response = await applyDataset(options.userId, dataset, input)

      return {
        result: response.result,
        messages: response.messages,
      }
    }
  }

  // web search
  {
    await logEvent({
      user: { id: options.userId },
      type: 'action.search.web',
      relations: {
        blueprintId: options.contextResources?.blueprintId,
        skillsetId: options.contextResources?.skillsetId,
        abilityId: options.contextResources?.abilityId,
      },
      meta: {
        params,
      },
    })

    // @todo check for limits and record usage

    const {
      type,
      descriptions: returnDescriptions,
      images: returnImages,
    } = z
      .object({
        type: z
          .enum(['web', 'news', 'images', 'videos'])
          .optional()
          .default('web'),
        descriptions: z.boolean().optional().default(true),
        images: z.boolean().optional().default(false),
      })
      // @note `description` and `image` do not match the schema's `descriptions`
      // and `images`, so neither ability parameter ever reaches it and both
      // always take their defaults: descriptions are always returned, and
      // images only for an image or video search.
      //
      // Preserved exactly through the search engine extraction rather than
      // fixed alongside it. Correcting the keys would start returning image
      // URLs for a plain web search that asked for them, and start dropping
      // descriptions for one that did not - a behaviour change, not a refactor.
      //
      // @todo fix the keys, deliberately and on its own
      .parse({
        type:
          params.type ??
          (() => {
            switch (true) {
              case 'web' in params: {
                return 'web'
              }

              case 'news' in params: {
                return 'news'
              }

              case 'images' in params: {
                return 'images'
              }

              case 'videos' in params: {
                return 'videos'
              }

              default: {
                return 'web'
              }
            }
          })(),
        description: params.description,
        image: params.image,
      })

    // @note which index answers this, and what credential it costs, belongs to
    // whichever @chatbotkit-dev/searchengine implementation is installed. A
    // deployment with none installed searches nothing and finds nothing, which
    // is the same answer this action has always given for a query the engine
    // could not serve.

    const results = await searchEngine.search(input, { type })

    // @note the engine returns everything it has and the caller decides what to
    // keep, because the reason for dropping a field is the token cost of
    // sending it to a model - which is this side's knowledge, not the engine's.
    //
    // Images are kept when asked for, and always for image and video searches,
    // where a result without one is not much of a result.

    const keepImages = returnImages || type === 'images' || type === 'videos'

    const result: SearchResultItem[] = results.map((item) => ({
      link: item.link,

      title: item.title,

      source: item.source,

      ...(returnDescriptions && item.description
        ? { description: item.description }
        : undefined),

      ...(keepImages && item.image ? { image: item.image } : undefined),
    }))

    return {
      result,
    }
  }
}

/**
 * @doc Skillsets
 * @index 41
 *
 * ## Search Action - Finding Information
 *
 * The search action allows your chatbot to search the web or specific datasets for information. It supports different search types including web, news, images, and videos. You can also search your own datasets by providing a dataset ID.
 *
 * ### Properties
 *
 * - **type**: The web search to perform - valid values are `web`, `news`, `images`, and `videos`
 * - **datasetId**: The ID of the dataset to search within your ChatBotKit account
 *
 * ### Example
 *
 * `````markdown
 * ```search
 * datasetId: ((datasetId! ys|the dataset ID to search))
 * query: $[query! ys|the search query]
 * ```
 * `````
 */

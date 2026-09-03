import type { Dataset } from '@/prisma/types'

import type { DatasetFilter } from '@/lib/dataset.filter'
import debug from '@/lib/debug'
import { captureException } from '@/lib/error'
import { logEvent } from '@/lib/log'
import { parseAndRevealRerankModel } from '@/lib/model.utils'
import { rerank } from '@/lib/rerank'
import { type StoreSearchRecord, getStore } from '@/lib/store.types'
import { recordRerankTokenUsage } from '@/lib/usage.record'

/**
 * Default number of candidate records fetched from the store before reranking,
 * used when the dataset's reranker config does not set `maxRecords`.
 */
const RERANK_PREFETCH_MAX_RECORDS = 20

export async function searchDataset(
  userId: string,
  dataset: Dataset,
  search: string,
  filter?: DatasetFilter
): Promise<StoreSearchRecord[]> {
  debug(`searchDataset`, { userId, dataset, search, filter }).log(
    'dataset.search.searchDataset'
  )

  const store = await getStore()

  let records: StoreSearchRecord[]

  if (dataset.reranker) {
    const { name: model, config } = parseAndRevealRerankModel(dataset.reranker)

    // @note the candidate prefetch cap is configurable per dataset via the
    // reranker model config (maxRecords), defaulting to RERANK_PREFETCH_MAX_RECORDS.

    const maxRecords = config.maxRecords ?? RERANK_PREFETCH_MAX_RECORDS

    const foundRecords = await store.searchRecords({
      datasetId: dataset.id,
      search,
      minScore: dataset.searchMinScore ?? undefined,
      maxRecords,

      filter: filter,
    })

    try {
      const { documents: rerankedRecords, usage } = await rerank(
        search,
        foundRecords,
        {
          model,
          topN: dataset.searchMaxRecords ?? undefined,
        }
      )

      // @note usage recording is best-effort; never fail the search because of it.
      // recordRerankTokenUsage no-ops on a zero count, so the caller does not gate
      // on usage.outputTokens - that is the recording layer's decision.
      try {
        await recordRerankTokenUsage({
          user: { id: userId },
          count: usage.outputTokens,
          model: usage.model,
        })
      } catch (e) {
        debug(`failed to record rerank usage`, { e }).log(
          'dataset.search.searchDataset'
        )
      }

      records = foundRecords
        .filter(({ id }) => rerankedRecords.some((r) => r.id === id))
        .sort((a, b) => {
          const aIndex = rerankedRecords.findIndex((r) => r.id === a.id)
          const bIndex = rerankedRecords.findIndex((r) => r.id === b.id)

          return aIndex - bIndex
        })
    } catch (e) {
      // @note reranking only reorders the candidates the store already returned,
      // so a slow or unreachable rerank provider (e.g. a Vercel AI Gateway
      // timeout) must not fail the whole
      // knowledge-base search. Degrade to the store's own score ordering,
      // capped to the requested record count, and report the failure so it
      // stays visible.
      await captureException(e)

      debug(`rerank failed, falling back to store order`, { e }).log(
        'dataset.search.searchDataset'
      )

      records = dataset.searchMaxRecords
        ? foundRecords.slice(0, dataset.searchMaxRecords)
        : foundRecords
    }
  } else {
    records = await store.searchRecords({
      datasetId: dataset.id,
      search,
      minScore: dataset.searchMinScore ?? undefined,
      maxRecords: dataset.searchMaxRecords ?? undefined,

      filter: filter,
    })
  }

  debug(`records`, { records }).log('dataset.search.searchDataset')

  await logEvent({
    user: { id: dataset.userId },
    type: 'dataset.search',
    relations: {
      blueprintId: dataset.blueprintId,
      datasetId: dataset.id,
    },
    meta: {
      search: search,
      records: records.map(({ id }) => id),
    },
  })

  return records
}

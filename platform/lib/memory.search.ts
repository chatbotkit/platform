import prisma from '@/prisma/client'

import debug from '@/lib/debug'
import { rerank } from '@/lib/rerank'
import { recordRerankTokenUsage } from '@/lib/usage.record'

/**
 * Memory item structure for reranking.
 */
export interface MemoryItem {
  id: string
  text: string
}

/**
 * Options for reranking memories.
 */
export interface RerankMemoriesOptions {
  /** When provided, rerank usage is recorded against this user. */
  user?: { id: string }
}

/**
 * Reranks a list of memory items based on a search query using the configured
 * rerank model.
 *
 * This is a reusable sorting function that takes pre-fetched memories and
 * reorders them by relevance to the search query.
 *
 * @param search - The search query to rank memories against
 * @param memories - Array of memory items to rerank
 * @param limit - Maximum number of results to return (topK)
 * @param options - Optional user for usage recording
 * @returns Reranked array of memory items ordered by relevance
 */
export async function rerankMemories<T extends MemoryItem>(
  search: string,
  memories: T[],
  limit: number,
  options?: RerankMemoriesOptions
): Promise<T[]> {
  if (memories.length === 0) {
    return []
  }

  const { documents, usage } = await rerank(search, memories, { topN: limit })

  if (options?.user) {
    // @note usage recording is best-effort; never fail the search because of it.
    // recordRerankTokenUsage no-ops on a zero count, so we do not gate on
    // usage.outputTokens - that is the recording layer's decision.
    try {
      await recordRerankTokenUsage({
        user: options.user,
        count: usage.outputTokens,
        model: usage.model,
      })
    } catch (e) {
      debug(`failed to record rerank usage`, { e }).log(
        'memory.search.rerankMemories'
      )
    }
  }

  return documents.map(
    ({ id }) => memories.find((m) => m.id === id) || ({ id, text: '' } as T)
  )
}

/**
 * Search options for filtering memories.
 */
export interface SearchMemoriesOptions {
  contactId?: string
  botId?: string
  /** How many records to fetch from the database (default: 50) */
  take?: number
  /** How many results to return after reranking (topK, default: 10) */
  limit?: number
}

/**
 * Searches memories for a user by performing a prisma query followed by
 * semantic reranking.
 *
 * This is a compound function that:
 * 1. Fetches memories from the database with optional filters
 * 2. Reranks them using the configured rerank model
 *
 * @param user - The user object containing the user id
 * @param search - The search query to find and rank memories
 * @param options - Optional filters for contactId, botId, take, and limit
 * @returns Array of memory items reranked by relevance
 */
export async function searchMemories(
  user: { id: string },
  search: string,
  options: SearchMemoriesOptions
): Promise<MemoryItem[]> {
  const { contactId, botId, take = 50, limit = 10 } = options

  const memories = await prisma.memory.findMany({
    where: {
      userId: user.id,
      contactId,
      botId,
    },

    select: {
      id: true,
      text: true,
    },

    orderBy: {
      updatedAt: 'desc',
    },

    take,
  })

  return rerankMemories(search, memories, limit, { user })
}

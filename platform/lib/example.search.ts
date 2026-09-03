// @ts-check
import { matchSearchText } from '@/lib/text.search'

import examplesData from '@/examples'

export type SearchResult = {
  slug: string
  score: number
  snippet: string
}

export type SearchOptions = {
  limit?: number
  threshold?: number
}

/**
 * Search examples using their local catalogue metadata.
 *
 * @param {string} query - The search query
 * @param {SearchOptions} [options] - Search options
 * @returns {Promise<SearchResult[]>} - Array of ranked search results
 */
export async function searchExamples(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const { limit = 20, threshold = 0 } = options

  if (!query || query.trim().length === 0) {
    return []
  }

  const results: SearchResult[] = []

  for (const example of examplesData) {
    const match = matchSearchText(query, [
      { value: example.title, weight: 12, excerpt: true },
      { value: example.keywords, weight: 8 },
      { value: example.description, weight: 6, excerpt: true },
      { value: example.commentary, weight: 3, excerpt: true },
      { value: example.blueprint, weight: 1 },
      { value: example.files, weight: 1 },
    ])

    if (!example.slug || !match || match.score < threshold) {
      continue
    }

    results.push({
      slug: example.slug,
      score: match.score,
      snippet: match.excerpt || example.description || '',
    })
  }

  results.sort((a, b) => b.score - a.score)

  return results.slice(0, limit)
}

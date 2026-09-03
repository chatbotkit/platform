// @ts-check

export type TextSearchField = {
  value: unknown
  weight: number
  excerpt?: boolean
}

export type TextSearchMatch = {
  score: number
  excerpt: string
}

function toText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value.join(' ')
  }

  if (value == null) {
    return ''
  }

  return JSON.stringify(value)
}

function countMatches(value: string, token: string): number {
  let count = 0
  let offset = 0
  let matchIndex = value.indexOf(token, offset)

  while (matchIndex !== -1) {
    count += 1
    offset = matchIndex + token.length
    matchIndex = value.indexOf(token, offset)
  }

  return count
}

function createExcerpt(value: string, tokens: string[]): string {
  const plain = value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`\[\](){}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!plain) {
    return ''
  }

  const lower = plain.toLowerCase()
  const positions = tokens
    .map((token) => lower.indexOf(token))
    .filter((position) => position >= 0)
  const start = Math.max(
    0,
    (positions.length ? Math.min(...positions) : 0) - 90
  )
  const excerpt = plain.slice(start, start + 320).trim()

  return `${start > 0 ? '…' : ''}${excerpt}${
    start + 320 < plain.length ? '…' : ''
  }`
}

export function tokenizeSearchQuery(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9_-]+/g)
        ?.filter((token) => token.length > 1) || []
    ),
  ]
}

/**
 * Rank a set of text fields without external services or generated indexes.
 */
export function matchSearchText(
  query: string,
  fields: TextSearchField[]
): TextSearchMatch | null {
  const normalizedQuery = query.trim().toLowerCase()
  const tokens = tokenizeSearchQuery(normalizedQuery)

  if (!tokens.length) {
    return null
  }

  let rawScore = 0
  let bestExcerpt = ''
  let bestExcerptScore = 0

  for (const field of fields) {
    const text = toText(field.value)
    const normalizedText = text.toLowerCase()
    let fieldScore = normalizedText.includes(normalizedQuery)
      ? field.weight * 2
      : 0

    for (const token of tokens) {
      fieldScore +=
        Math.min(countMatches(normalizedText, token), 5) * field.weight
    }

    rawScore += fieldScore

    if (field.excerpt && fieldScore > bestExcerptScore) {
      bestExcerpt = createExcerpt(text, tokens)
      bestExcerptScore = fieldScore
    }
  }

  if (rawScore === 0) {
    return null
  }

  return {
    score: rawScore / (rawScore + 20),
    excerpt: bestExcerpt,
  }
}

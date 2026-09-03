// @note the contract for searching the web. Implementations decide which index
// is consulted, how a query is scored, what a result costs and which vendor
// answers. None of that appears here, because none of it is the platform's
// concern.
//
// The platform's use of this module is narrow and worth stating, because it is
// what shapes everything below: results are read by a model, not by a person.
// That has three consequences the contract makes into rules rather than
// leaving to each implementation:
//
//   plain      - titles and descriptions are text, not markup. A model gains
//                nothing from <strong> and pays for it in tokens.
//
//   ordered    - results arrive in the engine's own relevance order and the
//                platform preserves it, so an engine that ranks well is not
//                undone by a caller that re-sorts.
//
//   forgiving  - a query that cannot be served yields no results rather than an
//                exception. See `search` for why that is the right failure.

/**
 * The kind of result being asked for.
 *
 * @note a closed set, because the platform exposes these four as an ability
 * parameter and a caller naming a fifth should find out at the type level.
 *
 * It names a kind of result, not a particular index. An engine that has no
 * separate news or video index answers from whatever it does have rather than
 * refusing - the caller wants recent articles, and which shard they came out of
 * is the engine's business.
 */
export type SearchResultType = 'web' | 'news' | 'images' | 'videos'

export interface SearchOptions {
  /** Defaults to `web`. */
  type?: SearchResultType
}

/**
 * One result.
 *
 * @note deliberately small. Every field beyond `link` and `title` is optional
 * because engines differ on what they return and for which kind of result, and
 * a contract that promised more would be promising on their behalf.
 */
export interface SearchResult {
  /** The URL the result points at. */
  link: string

  /**
   * Plain text, with any markup the engine emphasised the query with removed.
   */
  title: string

  /** Where the result came from, as the engine names it - usually a domain. */
  source?: string

  /** A summary or extract, plain text. Absent when the engine has none. */
  description?: string

  /**
   * A representative image, thumbnail or poster frame.
   *
   * @note present for `images` and `videos` results, and for other kinds when
   * the engine happens to have one. The platform decides whether to keep it:
   * an image URL is expensive in tokens and useless to a model that cannot see
   * it, so it drops the field unless it will be used.
   */
  image?: string
}

export interface SearchEngineProvider {
  /**
   * Runs a query and returns what the engine found, in its own order.
   *
   * @note an empty array is a normal answer, and it is also what a failed
   * upstream query returns. That is deliberate: the caller is in the middle of
   * a conversation, where "I found nothing" is something a model can work with
   * and a thrown error is not.
   *
   * It does not hide a misconfigured deployment, because that is what
   * `assertConfigured` is for. The split is between a credential that was never
   * set - which fails the build - and a request that failed today, which
   * degrades.
   */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>

  /**
   * Throws when this implementation is not usable with the current
   * configuration. See packages/AGENTS.md.
   *
   * @note an implementation resolves its own configuration lazily, so nothing
   * that merely imports it needs that configuration present. This is how the
   * guarantee comes back: the deployment calls this where its environment is
   * loaded and finds out then, rather than by watching every search quietly
   * return nothing.
   *
   * An implementation needing no configuration should resolve.
   */
  assertConfigured(): Promise<void>
}

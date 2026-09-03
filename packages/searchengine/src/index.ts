import type {
  SearchEngineProvider,
  SearchOptions,
  SearchResult,
} from '@chatbotkit-dev/searchengine-spec'

export type * from '@chatbotkit-dev/searchengine-spec'

// @note the parameters below are named for the contract rather than for what
// this implementation does with them, which is nothing. Renaming them to
// satisfy the linter would make the public default the one place the surface is
// hard to read against the spec.
/* eslint-disable unused-imports/no-unused-vars */

// @note the community implementation searches nothing, because searching the
// web needs an index and this package must run with nothing configured.
//
// It finds no results, which the contract already treats as a normal answer -
// see the note on `search` in the spec. A deployment with no engine installed
// therefore behaves exactly as it would without this module at all: an agent
// asked to search the web reports that it found nothing, and the conversation
// continues.
//
// This is the one place where the empty default is worth arguing about, so:
// the alternative is to throw, and throwing puts an error in front of a user
// for a capability their deployment never claimed to have. The platform
// already turns a failed upstream query into no results, so an engine that
// always finds nothing is a shape the caller has always had to handle.

/**
 * Finds nothing, because no index is configured.
 */
export async function search(
  query: string,
  options?: SearchOptions
): Promise<SearchResult[]> {
  return []
}

/**
 * @note the community implementation needs no configuration, so there is
 * nothing that can be misconfigured. It resolves rather than throwing because
 * a deployment that installs no search engine has made a choice, not a mistake
 * - unlike an empty model catalogue, which cannot serve any request at all.
 */
export async function assertConfigured(): Promise<void> {
  // pass
}

const provider: SearchEngineProvider = {
  search,
  assertConfigured,
}

export default provider

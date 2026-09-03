// @note the community default for semantic storage, with two backends behind
// one seam: JSON files with similarity computed here, and a Qdrant server when
// QDRANT_URL is set. Which one serves a call is decided per call, the way
// @chatbotkit-dev/memcache decides between memory and Redis, so tests and
// long-lived processes see environment changes rather than whatever was true
// at import.
//
// The file backend is the default because it needs nothing running: a dataset
// indexed there really is searchable by meaning, just linearly. Point
// QDRANT_URL at a Qdrant server - the repository's docker compose stands one
// up - and the same records land in a real index instead. The performance
// notes live with each backend, in `local.ts` and `qdrant.ts`.
//
// The credential is the part worth explaining, because it breaks the pattern.
// Every other public default runs with nothing configured. This one cannot:
// turning text into vectors requires an embedding model, and there is no
// embedding model that ships in a package. So `OPENAI_API_KEY` is required
// with either backend - Qdrant indexes vectors, it does not produce them -
// and `assertConfigured` fails without it rather than letting every search
// quietly return nothing. A backend that embeds server-side needs no such
// key, which is exactly why the contract is text in, text out.

import type {
  VectorListResult,
  VectorMatch,
  VectorProvider,
  VectorRecord,
  VectorScope,
  VectorSearchOptions,
  VectorFetchOptions,
  VectorListOptions,
  VectorRemoveBySourceOptions,
  VectorRemoveOptions,
  VectorUpsertOptions,
} from '@chatbotkit-dev/vector-spec'

import { VectorError, toVectorError } from './error'
import { provider as filesProvider } from './local'
import { provider as qdrantProvider } from './qdrant'

export type * from '@chatbotkit-dev/vector-spec'

export { VectorError }

function backend(): VectorProvider {
  return process.env.QDRANT_URL ? qdrantProvider : filesProvider
}

export async function upsert(options: VectorUpsertOptions): Promise<void> {
  return backend().upsert(options)
}

export async function fetch(
  options: VectorFetchOptions
): Promise<VectorRecord> {
  return backend().fetch(options)
}

export async function list(
  options: VectorListOptions
): Promise<VectorListResult> {
  return backend().list(options)
}

export async function count(options: VectorScope): Promise<number> {
  return backend().count(options)
}

export async function search(
  options: VectorSearchOptions
): Promise<VectorMatch[]> {
  return backend().search(options)
}

export async function remove(options: VectorRemoveOptions): Promise<void> {
  return backend().remove(options)
}

export async function removeBySource(
  options: VectorRemoveBySourceOptions
): Promise<void> {
  return backend().removeBySource(options)
}

export async function purge(options: VectorScope): Promise<void> {
  return backend().purge(options)
}

export async function assertConfigured(): Promise<void> {
  return backend().assertConfigured()
}

const provider: VectorProvider = {
  upsert,
  fetch,
  list,
  count,
  search,
  remove,
  removeBySource,
  purge,
  assertConfigured,
}

export default provider

// @note re-exported so a caller catching a failure can tell an unreachable
// endpoint from a bad record without matching on messages
export { toVectorError }

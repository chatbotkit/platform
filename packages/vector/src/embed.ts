/* eslint-disable no-restricted-globals */

// @note the embedding half of the community default. It exists because this
// package has to turn text into vectors itself, where a store that embeds
// server-side does not - it is handed text and a model name. That asymmetry is
// the reason the contract is text in, text out, and the reason this is the one
// public default in the repository that needs a credential.

import { getTextTokensLength, slice } from '@chatbotkit-dev/gpt'

import { VectorError } from './error'

const DEFAULT_MODEL = 'text-embedding-3-small'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

/**
 * @note 8000 rather than the model's actual 8191, matching the margin the
 * platform used before this moved. Token counting here and at OpenAI are two
 * implementations of the same spec, and they do occasionally disagree by a few
 * tokens on unusual input - a rejected batch costs an import, and the margin
 * costs nothing anyone can measure.
 */
const TOKEN_LIMIT = 8000

interface Config {
  apiKey: string
  baseUrl: string
  model: string
}

let cached: Config | undefined

/**
 * @note resolved on first use rather than at import, so that anything importing
 * the platform does not need an OpenAI key merely to load a module that might
 * one day index a record. See packages/AGENTS.md.
 *
 * @throws `EMBEDDING_FAILED` when no key is set, naming what to set
 */
function getConfig(): Config {
  if (!cached) {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new VectorError(
        'EMBEDDING_FAILED',
        'OPENAI_API_KEY is not set, so @chatbotkit-dev/vector cannot turn text into vectors - set it, or override @chatbotkit-dev/vector with a backend that embeds server-side'
      )
    }

    cached = {
      apiKey,
      baseUrl: process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL,
      model: process.env.VECTOR_EMBEDDING_MODEL || DEFAULT_MODEL,
    }
  }

  return cached
}

/**
 * @note exported for the tests, which need to vary the environment per case.
 */
export function resetConfig(): void {
  cached = undefined
}

export function getModel(): string {
  return getConfig().model
}

/**
 * Cuts text down to what the model will accept.
 *
 * @note token-based rather than character-based. A character budget is wrong by
 * a factor of three between English and CJK, in the direction that rejects the
 * whole batch.
 */
export function truncate(text: string): string {
  if (getTextTokensLength(text) <= TOKEN_LIMIT) {
    return text
  }

  return slice(text, 0, TOKEN_LIMIT)
}

/**
 * Embeds a batch of texts, in order.
 *
 * @throws `NOT_AUTHORIZED` when the key is rejected, `EMBEDDING_FAILED`
 * otherwise. The distinction matters because the first is a deployment fault
 * that will not fix itself and the second may be transient.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  const { apiKey, baseUrl, model } = getConfig()

  let response: Response

  try {
    response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },

      body: JSON.stringify({ model, input: texts.map(truncate) }),
    })
  } catch (error) {
    throw new VectorError(
      'EMBEDDING_FAILED',
      `the embedding endpoint at ${baseUrl} could not be reached`,
      { detail: error instanceof Error ? error.message : String(error) }
    )
  }

  if (!response.ok) {
    const detail = await response.text()

    if (response.status === 401 || response.status === 403) {
      throw new VectorError(
        'NOT_AUTHORIZED',
        'OPENAI_API_KEY was rejected by the embedding endpoint',
        { detail }
      )
    }

    throw new VectorError(
      'EMBEDDING_FAILED',
      `the embedding endpoint answered ${response.status}`,
      { detail }
    )
  }

  const body = (await response.json()) as {
    data?: { index: number; embedding: number[] }[]
  }

  const data = body.data

  if (!data || data.length !== texts.length) {
    throw new VectorError(
      'EMBEDDING_FAILED',
      `the embedding endpoint returned ${data?.length ?? 0} vectors for ${texts.length} inputs`
    )
  }

  // @note sorted by `index` rather than trusted to arrive in order. The API
  // documents that it may not, and a silently permuted batch attaches every
  // record's text to another record's vector - which is not an error anyone
  // would notice until search results made no sense.

  const vectors: number[][] = new Array(texts.length)

  for (const entry of data) {
    vectors[entry.index] = entry.embedding
  }

  return vectors
}

import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { defaultRerankModel } from '@/config/models'

import debug from '@/lib/debug'
import { rerank as rerankVercel } from '@/lib/model.provider.vercel.adaptor'
import { parseAndRevealRerankModel } from '@/lib/model.utils'

interface RerankUsage {
  model: string
  inputTokens: number
  outputTokens: number
}

interface RerankDocument {
  id: string
  text: string
}

interface RerankedDocument {
  id: string
  index: number
  score: number
}

interface RerankOptions {
  model?: string
  topN?: number
  user?: string
  signal?: AbortSignal
}

interface RerankResult {
  documents: RerankedDocument[]
  usage: RerankUsage
}

/**
 * Reranks documents by relevance to a query using the configured rerank model.
 *
 * @note this mirrors the createImage/createVideo modules: it resolves the model,
 * dispatches to the provider adaptor, and returns the reranked documents along
 * with usage. The usage is returned (not recorded here) so the caller can record
 * it against the usage log, consistent with the image/video modules.
 */
export async function rerank(
  query: string,
  documents: RerankDocument[],
  options?: RerankOptions
): Promise<RerankResult> {
  debug(`reranking`, { query, documentCount: documents.length, options })

  const { model = defaultRerankModel, topN, signal } = options || {}

  const { name, config } = parseAndRevealRerankModel(model)

  const provider = config.provider

  let usage: RerankUsage
  let rerankedDocuments: RerankedDocument[]

  switch (provider) {
    case 'vercel': {
      const result = await rerankVercel({
        model: name,

        query,
        documents,

        topN,

        signal,
      })

      rerankedDocuments = result.documents
      usage = result.usage

      break
    }

    default: {
      assertUnreachable(provider)
    }
  }

  return {
    documents: rerankedDocuments,
    usage: { ...usage, model: name },
  }
}

import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { decisionModels, defaultDecisionModel } from '@/config/models'

import debug from '@/lib/debug'
import type {
  CreateDecisionResult,
  DecisionInput,
  DecisionQuestion,
} from '@/lib/decision.types'
import { decide as decideOpenRouter } from '@/lib/model.provider.openrouter'
import { decide as decideTypeSafe } from '@/lib/model.provider.typesafe'
import { decide as decideVercel } from '@/lib/model.provider.vercel'
import { parseAndRevealDecisionModel } from '@/lib/model.utils'
import { throwBadRequest } from '@/lib/response'

interface CreateDecisionOptions {
  model?: string
  signal?: AbortSignal
}

/**
 * Answers typed questions about a state using the configured decision model.
 *
 * @note the usage is returned (not recorded here) so the caller can record it
 * against the usage log, consistent with the image/video/rerank modules.
 */
export async function createDecision(
  state: DecisionInput,
  questions: Record<string, DecisionQuestion>,
  options?: CreateDecisionOptions
): Promise<CreateDecisionResult> {
  debug(`creating decision`, {
    questionCount: Object.keys(questions).length,
    options,
  })

  const { model = defaultDecisionModel, signal } = options || {}

  // @note a deployment serves decision models only when a provider key is set;
  // without one the catalogue is empty and any name would pass validation

  if (!Object.keys(decisionModels).length) {
    throwBadRequest('No decision model is configured on this deployment')
  }

  const { name, config } = parseAndRevealDecisionModel(model)

  const provider = config.provider

  let decide: typeof decideVercel

  switch (provider) {
    case 'typesafe': {
      decide = decideTypeSafe

      break
    }

    case 'vercel': {
      decide = decideVercel

      break
    }

    case 'openrouter': {
      decide = decideOpenRouter

      break
    }

    default: {
      assertUnreachable(provider)
    }
  }

  // @note transient failures are retried by each provider's fetch instance;
  // retrying again here would multiply the attempts against a failing provider

  const { answers, usage } = await decide({
    model: config.providerModel || name,
    modelOptions: config.providerOptions,

    state,
    questions,

    signal,
  })

  return {
    answers,
    usage: { ...usage, model: name },
  }
}

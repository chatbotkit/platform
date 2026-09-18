import debug from '@/lib/debug'
import type {
  CreateDecisionOptions,
  CreateDecisionResult,
  DecisionAnswer,
  DecisionQuestion,
} from '@/lib/decision.types'
import _fetch, { withRetry, withTimeout } from '@/lib/fetch'
import { resolveProviderCredential } from '@/lib/model.credentials'
import { getOpenAIError } from '@/lib/model.provider.openai'

/**
 * fetch instance dedicated for decisions, bounded so a slow provider fails
 * within the response budget.
 */
const fetchForDecision = withRetry(withTimeout(_fetch, { timeout: 15_000 }), {
  retries: 5,
  retryDelay: 250,
  retryTimeout: false,
})

/**
 * Gets the TypeSafe API key from the environment.
 *
 * @throws {UserConfigError} if no key is configured
 */
export function getTypeSafeAPIKey(): string {
  return resolveProviderCredential({
    label: 'TypeSafe',
    storeKey: undefined,
    storeUrl: undefined,
    envKey: process.env.TYPESAFE_MODELS_API_KEY,
  })
}

// --- Decision ---

/**
 * Converts questions to the System One wire format.
 *
 * @note System One names the boolean question type `noul`; everything else is
 * carried as is. OpenRouter's decisions endpoint speaks the same format.
 */
export function toSystemOneQuestions(
  questions: Record<string, DecisionQuestion>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(questions).map(([key, question]) => [
      key,
      question.type === 'boolean' ? { ...question, type: 'noul' } : question,
    ])
  )
}

interface SystemOneAnswer {
  type: string
  noul?: number
  choice?: string
  score?: number
  probabilities?: Record<string, number>
}

/**
 * Converts System One answers to the platform answer format.
 */
export function fromSystemOneAnswers(
  answers: Record<string, SystemOneAnswer> | undefined
): Record<string, DecisionAnswer> {
  return Object.fromEntries(
    Object.entries(answers || {}).map(([key, answer]) => {
      switch (answer.type) {
        case 'noul': {
          return [key, { type: 'boolean', probability: answer.noul }]
        }

        case 'choice': {
          return [
            key,
            {
              type: 'choice',
              choice: answer.choice,
              probabilities: answer.probabilities,
            },
          ]
        }

        case 'score': {
          return [
            key,
            {
              type: 'score',
              score: answer.score,
              probabilities: answer.probabilities,
            },
          ]
        }

        default: {
          throw new Error(`Unrecognized answer type ${answer.type}`)
        }
      }
    })
  )
}

/**
 * Reads the reason out of an error response.
 *
 * @note the API documents that a validation error names the offending field
 * but not the shape of the body, so the common shapes are all tried. An
 * unrecognised body yields no message and the status text stands in.
 */
async function getErrorMessage(response: Response): Promise<string | undefined> {
  let data: Record<string, unknown> | null

  try {
    data = await response.json()
  } catch {
    return undefined
  }

  const error = data?.error

  const reason =
    (typeof error === 'object' && error !== null
      ? (error as Record<string, unknown>).message
      : undefined) ??
    error ??
    data?.message ??
    data?.detail

  if (typeof reason === 'string') {
    return reason
  }

  if (reason !== undefined && reason !== null) {
    return JSON.stringify(reason)
  }

  return undefined
}

/**
 * Answers typed questions about a state using TypeSafe's System One API.
 */
export async function decide(
  options: CreateDecisionOptions
): Promise<CreateDecisionResult> {
  const { state, questions, model, signal } = options

  debug(`decide using`, {
    model,
    questionCount: Object.keys(questions).length,
  }).log('typesafe.decide')

  const body = {
    model,

    state,
    questions: toSystemOneQuestions(questions),
  }

  const response = await fetchForDecision(
    'https://api.typesafe.ai/v1/systemone',
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${getTypeSafeAPIKey()}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(body),

      signal,
    }
  )

  if (!response.ok) {
    throw getOpenAIError(
      {
        response: {
          status: response.status,
          data: { error: { message: await getErrorMessage(response) } },
        },
      },
      { errorPrefix: 'TS_' }
    )
  }

  const data = await response.json()

  debug(`received data`, { data }).log('typesafe.decide.received')

  return {
    answers: fromSystemOneAnswers(data.answers),
    usage: {
      model,
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  }
}

import debug from '@/lib/debug'
import {
  createChatCompletionStream as createChatCompletionStreamForOpenAI,
  createTextCompletionStream as createTextCompletionStreamForOpenAI,
} from '@/lib/model.provider.openai.adaptor'
import { createChatCompletionStream as createChatCompletionStreamForOpenRouter } from '@/lib/model.provider.openrouter.adaptor'
import { createChatCompletionStream as createChatCompletionStreamForVercel } from '@/lib/model.provider.vercel.adaptor'
import {
  isOpenAIModel,
  isOpenrouterModel,
  isVercelModel,
  modelSupportsChat,
  parseAndRevealLanguageModel,
} from '@/lib/model.utils'
import { replaceWithMap } from '@/lib/string'

/**
 * Configuration for the prompt execution.
 */
export interface PromptSpec {
  prompt: string
  model: string
  output?: 'text' | 'json' | 'schema'
  schema?: Record<string, unknown>
  stop?: string[]
  user: string
  timeout?: number
  retries?: number
  retryDelay?: number
  retryTimeout?: boolean
}

/**
 * Interface for streaming prompt results.
 */
export interface PromptSink {
  push: (type: string, data: unknown) => Promise<void>
}

/**
 * Options for executing a prompt.
 */
export interface ExecPromptOptions {
  sink?: PromptSink
  abortSignal?: AbortSignal
}

/**
 * Result of a prompt execution.
 */
export interface ExecPromptResult {
  completion: string
  tokensUsed: number
  modelUsed: string
}

/**
 * Computes the final prompt by replacing placeholders with parameter values.
 */
export function computePrompt(
  spec: { prompt: string },
  params: Record<string, string>
): string {
  // @todo throw an error if some params are missing yet required

  const computedPrompt = replaceWithMap(
    spec.prompt,
    Object.fromEntries(
      Object.entries(params).map(([name, value]) => {
        return [`{${name}}`, value]
      })
    )
  )

  return computedPrompt
}

/**
 * Executes a prompt using the specified model and returns the completion result.
 */
export async function execPrompt(
  spec: PromptSpec,
  params: Record<string, string>,
  options?: ExecPromptOptions
): Promise<ExecPromptResult> {
  // @todo carefully calculate the replacement and trim to length so that we
  // never exceed the max tokens

  const {
    model,

    output,
    schema,

    user,

    timeout,

    retries,
    retryDelay,
    retryTimeout,
  } = spec

  const { sink, abortSignal } = options || {}

  const computedPrompt = computePrompt(spec, params)

  debug(`executing prompt`, { computedPrompt }).log('prompt.execPrompt')

  let completion = ''
  let tokens = 0

  const { name: modelName, config: modelConfig } =
    parseAndRevealLanguageModel(model)

  modelConfig // @todo use the model config instead

  switch (true) {
    case isOpenAIModel(model) && modelSupportsChat(model): {
      for await (const {
        completion: _completion,
      } of createChatCompletionStreamForOpenAI({
        messages: [
          {
            role: 'user',
            content: computedPrompt,
          },
        ],

        model: modelName,

        temperature: modelConfig.temperature,

        frequencyPenalty: modelConfig.frequencyPenalty,
        presencePenalty: modelConfig.presencePenalty,

        responseFormat:
          {
            text: {
              type: 'text' as const,
            },
            json: {
              type: 'json_object' as const,
            },
            schema: {
              type: 'json_schema' as const,
              json_schema: schema as Record<string, unknown>,
            },
          }[output as 'text' | 'json' | 'schema'] ||
          (schema
            ? {
                type: 'json_schema' as const,
                json_schema: schema as Record<string, unknown>,
              }
            : undefined),

        user,

        timeout,

        retries,
        retryDelay,
        retryTimeout,

        signal: abortSignal,
      })) {
        if (_completion) {
          completion += _completion

          await sink?.push('token', {
            token: _completion,
          })
        }

        tokens += 1
      }

      break
    }

    case isOpenAIModel(model) && !modelSupportsChat(model): {
      for await (const {
        completion: _completion,
      } of createTextCompletionStreamForOpenAI({
        prompt: computedPrompt,

        model: modelName,

        temperature: modelConfig.temperature,

        frequencyPenalty: modelConfig.frequencyPenalty,
        presencePenalty: modelConfig.presencePenalty,

        // responseFormat: output,

        // @note this is necessary for legacy APIs
        // @todo perhaps calculate the max tokens based on the model

        maxTokens: 2000,

        user,

        timeout,

        retries,
        retryDelay,

        signal: abortSignal,
      })) {
        // @todo handle output format

        if (_completion) {
          completion += _completion

          await sink?.push('token', {
            token: _completion,
          })
        }

        tokens += 1
      }

      break
    }

    case isOpenrouterModel(model) && modelSupportsChat(model): {
      for await (const {
        completion: _completion,
      } of createChatCompletionStreamForOpenRouter({
        messages: [
          {
            role: 'user',
            content: computedPrompt,
          },
        ],

        model: modelName,

        temperature: modelConfig.temperature,

        frequencyPenalty: modelConfig.frequencyPenalty,
        presencePenalty: modelConfig.presencePenalty,

        responseFormat:
          {
            text: {
              type: 'text' as const,
            },
            json: {
              type: 'json_object' as const,
            },
            schema: {
              type: 'json_schema' as const,
              json_schema: schema as Record<string, unknown>,
            },
          }[output as 'text' | 'json' | 'schema'] ||
          (schema
            ? {
                type: 'json_schema' as const,
                json_schema: schema as Record<string, unknown>,
              }
            : undefined),

        user,

        timeout,

        retries,
        retryDelay,
        retryTimeout,

        signal: abortSignal,
      })) {
        if (_completion) {
          completion += _completion

          await sink?.push('token', {
            token: _completion,
          })
        }

        tokens += 1
      }

      break
    }

    case isVercelModel(model) && modelSupportsChat(model): {
      for await (const {
        completion: _completion,
      } of createChatCompletionStreamForVercel({
        messages: [
          {
            role: 'user',
            content: computedPrompt,
          },
        ],

        model: modelName,

        temperature: modelConfig.temperature,

        frequencyPenalty: modelConfig.frequencyPenalty,
        presencePenalty: modelConfig.presencePenalty,

        responseFormat:
          {
            text: {
              type: 'text' as const,
            },
            json: {
              type: 'json_object' as const,
            },
            schema: {
              type: 'json_schema' as const,
              json_schema: schema as Record<string, unknown>,
            },
          }[output as 'text' | 'json' | 'schema'] ||
          (schema
            ? {
                type: 'json_schema' as const,
                json_schema: schema as Record<string, unknown>,
              }
            : undefined),

        user,

        timeout,

        retries,
        retryDelay,
        retryTimeout,

        signal: abortSignal,
      })) {
        if (_completion) {
          completion += _completion

          await sink?.push('token', {
            token: _completion,
          })
        }

        tokens += 1
      }

      break
    }

    default: {
      throw new Error('Unsupported model provider')
    }
  }

  debug(`prompt execution completed`, { completion, tokens, model }).log(
    'prompt.execPrompt'
  )

  await sink?.push('result', {
    completion: completion || '',
    tokensUsed: tokens,
    modelUsed: modelName,
  })

  return {
    completion: completion || '',

    tokensUsed: tokens,
    modelUsed: modelName,
  }
}

import { defaultLanguageModel } from '@/config/models'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import debug from '@/lib/debug'
import { accountLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import { execPrompt } from '@/lib/prompt'
import { Usage } from '@/lib/usage.model'
import { fastGetUserById } from '@/lib/user.get'
import { z } from '@/lib/zod.schema'

// @todo translate data/abilities/catalogue/cbk.text.yaml to ts

/**
 * Schema for text action parameters
 */
export const executeTextSchema = z.object({
  input: z.string().describe('The input text to process'),
  model: z.string().nullable().optional().describe('The language model to use'),
})

/**
 * Executes a text action. This action is used to generate text based on the
 * input and the parameters.
 */
export async function executeTextAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  const user = await fastGetUserById(options.userId)

  if (!user) {
    throw new Error(`User not found`)
  }

  if (!(await accountLimitsOk(user, ['token']))) {
    const error = 'You have reached your token limit.'

    return {
      error: error,
    }
  }

  debug(`using`, { input, params, options })

  await logEvent({
    user: { id: options.userId },
    type: 'action.text',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: params,
  })

  const { input: _input, model: _model } = getConfigBySchema({
    input,
    params,
    initial: {
      input: input,
    },
    schema: executeTextSchema,
    options,
  })

  const model = _model || defaultLanguageModel

  const {
    completion: result,
    tokensUsed,
    modelUsed,
  } = await execPrompt(
    {
      prompt: input,
      model: model,
      user: options.userId,
    },
    params as Record<string, string>
  )

  debug(`using result`, { result: result.substring(0, 256) })

  await Usage.createAndRecord({
    user: { id: options.userId },
    token: tokensUsed,
    model: modelUsed,
    meta: {
      ...options.usageMeta,

      reason: 'action/text',
    },
    references: {
      ...options.linkedResources,
      ...options.contextResources,
    },
  })

  return {
    result: result,
  }
}

/**
 * @doc Skillsets
 * @index 46
 *
 * ## Text Action - Generating Content
 *
 * The text action generates text content using a language model based on the input prompt. This is useful for creating dynamic content, transforming text, generating creative writing, or producing structured output.
 *
 * ### Properties
 *
 * - **model**: Any of the supported ChatBotKit language models can be used, such as `glm-5.2`, `gpt-5.5`, `claude-4.8-opus`, `gemini-3.5-flash`, etc.
 *
 * ### Example
 *
 * `````markdown
 * ```text
 * model: ((model ys|the language model to use))
 * input: $[input! ys|the text generation prompt]
 * ```
 * `````
 */

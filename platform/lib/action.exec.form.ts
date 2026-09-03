import { MessageType } from '@/prisma/types'

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

import generateFormPromptV1 from '@/prompts/generate_form_v1.yaml'

// @todo deprecated - use executeTextAction instead
// @todo migrate existing actions that use this to executeTextAction

/**
 * Executes a form action. This action is used to generate HTML forms based on
 * the input and the parameters.
 *
 * @deprecated since 2024-06-10 - replaced by executeTextAction
 */
export async function executeFormAction(
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
    type: 'action.form',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: params,
  })

  const {
    completion: result,
    tokensUsed,
    modelUsed,
  } = await execPrompt(
    {
      ...generateFormPromptV1,

      user: options.userId,
    },
    {
      input: input,
    }
  )

  debug(`using result`, { result: result.substring(0, 256) })

  await Usage.createAndRecord({
    user: { id: options.userId },
    token: tokensUsed,
    model: modelUsed,
    meta: {
      ...options.usageMeta,

      reason: 'action/form',
    },
    references: {
      ...options.linkedResources,
      ...options.contextResources,
    },
  })

  return {
    result: result,
    hintMessages: [
      {
        type: MessageType.context,
        text: 'Return the HTML form as is to be rendered in the browser. Do not use markdown codeblocks.',
      },
    ],
  }
}

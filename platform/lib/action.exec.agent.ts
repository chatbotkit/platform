import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import prisma from '@/prisma/client'
import { MessageType } from '@/prisma/types'

import { getConfigBySchema } from '@/lib/action.config'
import type {
  ActionInput,
  ActionMessage,
  ActionOptions,
  ActionParams,
  ActionReturn,
} from '@/lib/action.exec.all'
import { getConversationDetailsField } from '@/lib/bot.conversation'
import { getAutoEngine } from '@/lib/conversation.engine'
import debug from '@/lib/debug'
import { UserInputError, captureError } from '@/lib/error'
import { accountLimitsOk } from '@/lib/limit.core'
import { logEvent } from '@/lib/log'
import { fastGetUserById } from '@/lib/user.get'
import { z } from '@/lib/zod.schema'

// @see data/abilities/catalogue/cbk.agent.ts for ability definitions related
// to these schemas

// --- Schemas ---

const MAX_AGENT_TIMEOUT = 300_000

export const spawnSchema = z.object({
  backstory: z.string().optional(),
  model: z.string().optional(),
  instructions: z.string().optional(),
  timeout: z.coerce.number().int().min(1).max(MAX_AGENT_TIMEOUT).optional(),
})

export const SPAWN_OPERATION_NAME = 'spawn'

export type SpawnSchema = z.infer<typeof spawnSchema>

// --- Params ---

interface AgentActionParams {
  input: string
  params: ActionParams
  options: ActionOptions
}

// --- Utils ---

interface AgentExecutionControl {
  abortSignal: AbortSignal | undefined
  cleanup: () => void
  didTimeout: () => boolean
}

function combineAbortSignals(
  signals: Array<AbortSignal | undefined>
): AbortSignal | undefined {
  const filteredSignals = signals.filter(Boolean)

  if (filteredSignals.length === 0) {
    return undefined
  }

  const controller = new AbortController()

  for (const signal of filteredSignals) {
    if (!signal) {
      continue
    }

    if (signal.aborted) {
      controller.abort(signal.reason)

      return controller.signal
    }

    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      signal: controller.signal,
    })
  }

  return controller.signal
}

function createAgentExecutionControl(
  timeout: number | undefined,
  signal: AbortSignal | undefined
): AgentExecutionControl {
  if (!timeout) {
    return {
      abortSignal: signal,
      cleanup() {},
      didTimeout() {
        return false
      },
    }
  }

  const abortController = new AbortController()

  let didTimeout = false

  const timer = setTimeout(() => {
    didTimeout = true
    abortController.abort('abort')
  }, timeout)

  return {
    abortSignal: combineAbortSignals([abortController.signal, signal]),
    cleanup() {
      clearTimeout(timer)
    },
    didTimeout() {
      return didTimeout
    },
  }
}

function getAbortSpawnActionReturn(): ActionReturn {
  return {
    result: {
      result: 'abort',
      messages: [],
    },
  }
}

// --- Handlers ---

/**
 * Spawns a sub-agent to process a task with configurable backstory and model.
 *
 * This function creates a pseudo-conversation context and uses an AI engine to
 * process instructions. It handles operations like planning, evaluation,
 * execution, generation, and completion by delegating to a sub-agent with the
 * specified configuration.
 *
 * @param input - The backstory or base input for the agent
 * @param params - Action parameters containing the operation type and configuration
 * @param options - Action options including userId, linked resources, and messages
 * @returns The result of the agent processing, including output text and activity messages
 */
export async function doAgentSpawn({
  input,
  params,
  options,
}: AgentActionParams): Promise<ActionReturn> {
  debug(`do agent spawn`, { input, params, options }).log(
    'action.exec.agent.doAgentSpawn'
  )

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

  debug(`using`, { input, params, options }).log(
    'action.exec.agent.doAgentSpawn'
  )

  await logEvent({
    user: { id: options.userId },
    type: 'action.agent.spawn',
    relations: {
      blueprintId: options.contextResources?.blueprintId,
      skillsetId: options.contextResources?.skillsetId,
      abilityId: options.contextResources?.abilityId,
    },
    meta: params,
  })

  const {
    backstory: _backstory,
    model: _model,
    instructions,
    timeout,
  } = getConfigBySchema({
    input,
    params,
    initial: {
      backstory: input,
    },
    schema: spawnSchema,
    options,
  })

  let backstory = _backstory
  let model = _model

  // if the backstory or model is not provided, we will try to get it from the
  // bot if linked resources are provided
  {
    if (!backstory || !model) {
      if (options.linkedResources?.botId) {
        const bot = await prisma.bot.findUniqueByIdentifier(
          { id: options.userId },
          options.linkedResources.botId
        )

        if (bot) {
          if (!backstory) {
            backstory = bot.backstory
          }

          if (!model) {
            model = bot.model
          }
        }
      }
    }
  }

  let result: string | undefined
  let messages: ActionMessage[] | undefined

  const executionControl = createAgentExecutionControl(timeout, options.signal)

  const pseudoConversation = {
    backstory,

    model,

    // pulled-in resources

    messages: [
      // add all previous messages to preserve the conversational context

      ...(options.messages || []),

      // add the task as a message

      ...(instructions
        ? [
            {
              type: MessageType.instruction,
              text: instructions,
            },
          ]
        : []),
    ],
  }

  debug(`pseudoConversation`, { pseudoConversation }).log(
    'action.exec.agent.doAgentSpawn'
  )

  const engine = await getAutoEngine({
    options: {
      userId: options.userId,

      // @note disabled for now because it is causing a lot of issues
      // sink: options.sink,

      usageMeta: {
        // @note without this task and other things that rely on the bot
        // information will not work

        ...options?.usageMeta,
      },

      backstory:
        getConversationDetailsField(pseudoConversation, 'backstory') ??
        undefined,

      model:
        getConversationDetailsField(pseudoConversation, 'model') ?? undefined,

      messages: pseudoConversation.messages,
      signal: executionControl.abortSignal,
    },
  })

  try {
    await engine.process()

    const { messages: completeMessages } = await engine.complete()

    const lastCompleteMessage = completeMessages.slice(0).pop()

    result = lastCompleteMessage?.text || ''

    messages = completeMessages.filter(
      ({ type }) => type === MessageType.activity
    ) as ActionMessage[]

    // @note the usage is recorded in the engine
  } catch (e) {
    if (executionControl.didTimeout()) {
      return getAbortSpawnActionReturn()
    }

    debug(`responding with error`, { e }).log('action.exec.agent.doAgentSpawn')

    await captureError(e)
  } finally {
    executionControl.cleanup()
  }

  if (executionControl.didTimeout()) {
    return getAbortSpawnActionReturn()
  }

  debug(`result`, { result, messages }).log('action.exec.agent.doAgentSpawn')

  return {
    // @note disabled because we are combining everything in the result
    // result: result,
    // messages: messages,

    result: {
      result: result,
      messages: messages,
    },
  }
}

// --- Main ---

/**
 * Executes a bot action on a specific bot. This action is used to
 * apply a bot to a specific input.
 */
export async function executeAgentAction(
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`execute agent action`, { input, params, options }).log(
    'action.exec.agent.executeAgentAction'
  )

  let operation: typeof SPAWN_OPERATION_NAME

  {
    switch (true) {
      case 'spawn' in params: {
        operation = SPAWN_OPERATION_NAME

        break
      }

      default: {
        throw new UserInputError(`Unknown operation`)
      }
    }
  }

  let response: ActionReturn

  switch (operation) {
    case SPAWN_OPERATION_NAME: {
      response = await doAgentSpawn({ input, params, options })

      break
    }

    default: {
      assertUnreachable(operation)
    }
  }

  return response
}

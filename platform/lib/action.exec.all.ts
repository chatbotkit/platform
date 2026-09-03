import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import type { MessageType } from '@/prisma/types'

import { executeAbortAction } from '@/lib/action.exec.abort'
import { executeAgentAction } from '@/lib/action.exec.agent'
import { executeAttachmentAction } from '@/lib/action.exec.attachment'
import { executeBlueprintAction } from '@/lib/action.exec.blueprint'
import { executeBotAction } from '@/lib/action.exec.bot'
import { executeConversationAction } from '@/lib/action.exec.conversation'
import { executeDatasetAction } from '@/lib/action.exec.dataset'
import { executeEchoAction } from '@/lib/action.exec.echo'
import { executeEmailAction } from '@/lib/action.exec.email'
import { executeFetchAction } from '@/lib/action.exec.fetch'
import { executeFileAction } from '@/lib/action.exec.file'
import { executeFormAction } from '@/lib/action.exec.form'
import { executeImageAction } from '@/lib/action.exec.image'
import { executeListenAction } from '@/lib/action.exec.listen'
import { executeListAction } from '@/lib/action.exec.list'
import { executeMcpAction } from '@/lib/action.exec.mcp'
import { executeMemoryAction } from '@/lib/action.exec.memory'
import { executePackAction } from '@/lib/action.exec.pack'
import { executeRatingAction } from '@/lib/action.exec.rating'
import { executeSearchAction } from '@/lib/action.exec.search'
import { executeShellAction } from '@/lib/action.exec.shell'
import { executeSkillsetAction } from '@/lib/action.exec.skillset'
import { executeSpaceAction } from '@/lib/action.exec.space'
import { executeTaskAction } from '@/lib/action.exec.task'
import { executeTextAction } from '@/lib/action.exec.text'
import { executeTimeAction } from '@/lib/action.exec.time'
import { executeTodoAction } from '@/lib/action.exec.todo'
import { executeViewAction } from '@/lib/action.exec.view'
import { ActionName } from '@/lib/action.name'
import type { Sink } from '@/lib/conversation.tag'
import debug from '@/lib/debug'
import type { Message } from '@/lib/message'

// @note Re-exporting Sink for backwards compatibility with consumers that
// import from this module. The canonical source is '@/lib/conversation.tag'.

export type { Sink } from '@/lib/conversation.tag'

/**
 * The input type for actions
 */
export type ActionInput = string

/**
 * Parameters for actions - these should not be editable by AI agents themselves
 * as they are considered "system-level" parameters.
 *
 * @note this is actually not enforced and
 */
export type ActionParams = Record<string, unknown>

/**
 * Options for actions that provide additional context
 */
export interface ActionOptions {
  userId: string
  signal?: AbortSignal
  contextResources?: {
    skillsetId?: string
    abilityId?: string
    blueprintId?: string
  }
  linkedResources?: {
    secretId?: string
    fileId?: string
    botId?: string
    spaceId?: string
  }
  inlineSecrets?: Record<string, { value: string }>
  messages?: Message[]
  meta?: Record<string, unknown>
  usageMeta?: Record<string, unknown>
  sink?: Sink
}

/**
 * The error type for actions
 */
export type ActionError = string

/**
 * The result type for actions
 */
export type ActionResult = unknown

/**
 * The message type for actions
 */
export interface ActionMessage {
  type: MessageType
  text: string
  meta?: Record<string, unknown>
}

/**
 * The return type for actions
 */
export interface ActionReturn {
  error?: ActionError
  result?: ActionResult
  messages?: ActionMessage[]
  hintMessages?: ActionMessage[]
  debugMessages?: ActionMessage[]
}

/**
 * Main method for handling all types of action. An action is just a single
 * executable block that is mostly deterministic in nature. Examples include
 * things such as making a HTTP request, outputting a looking table, etc.
 */
export async function executeAction(
  name: ActionName,
  input: ActionInput,
  params: ActionParams,
  options: ActionOptions
): Promise<ActionReturn> {
  debug(`executing action`, { name, input, params, options })

  switch (name) {
    case ActionName.search: {
      return await executeSearchAction(input, params, options)
    }

    case ActionName.blueprint: {
      return await executeBlueprintAction(input, params, options)
    }

    case ActionName.bot: {
      return await executeBotAction(input, params, options)
    }

    case ActionName.dataset: {
      return await executeDatasetAction(input, params, options)
    }

    case ActionName.skillset: {
      return await executeSkillsetAction(input, params, options)
    }

    case ActionName.memory: {
      return await executeMemoryAction(input, params, options)
    }

    case ActionName.space: {
      return await executeSpaceAction(input, params, options)
    }

    case ActionName.file: {
      return await executeFileAction(input, params, options)
    }

    case ActionName.attachment: {
      return await executeAttachmentAction(input, params, options)
    }

    case ActionName.fetch: {
      return await executeFetchAction(input, params, options)
    }

    case ActionName.view: {
      return await executeViewAction(input, params, options)
    }

    case ActionName.listen: {
      return await executeListenAction(input, params, options)
    }

    case ActionName.text: {
      return await executeTextAction(input, params, options)
    }

    case ActionName.image: {
      return await executeImageAction(input, params, options)
    }

    case ActionName.email: {
      return await executeEmailAction(input, params, options)
    }

    case ActionName.form: {
      return await executeFormAction(input, params, options)
    }

    case ActionName.echo: {
      return await executeEchoAction(input, params, options)
    }

    case ActionName.abort: {
      return await executeAbortAction(input, params, options)
    }

    case ActionName.shell: {
      return await executeShellAction(input, params, options)
    }

    case ActionName.conversation: {
      return await executeConversationAction(input, params, options)
    }

    case ActionName.task: {
      return await executeTaskAction(input, params, options)
    }

    case ActionName.time: {
      return await executeTimeAction(input, params, options)
    }

    case ActionName.rating: {
      return await executeRatingAction(input, params, options)
    }

    case ActionName.pack: {
      return await executePackAction(input, params, options)
    }

    case ActionName.agent: {
      return await executeAgentAction(input, params, options)
    }

    case ActionName.mcp: {
      return await executeMcpAction(input, params, options)
    }

    case ActionName.todo: {
      return await executeTodoAction(input, params, options)
    }

    case ActionName.list: {
      return await executeListAction(input, params, options)
    }

    default: {
      assertUnreachable(name)
    }
  }
}

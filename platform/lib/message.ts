import { MessageType } from '@/prisma/types'

/**
 * Core message structure shared by all message types
 */
export interface CoreMessage {
  type: string
  text: string
  meta?: Record<string, unknown>
}

export interface UserMessage extends CoreMessage {
  type: 'user'
}

export interface BotMessage extends CoreMessage {
  type: 'bot'
}

export interface ReasoningMessage extends CoreMessage {
  type: 'reasoning'
}

export interface ContextMessage extends CoreMessage {
  type: 'context'
}

export interface InstructionMessage extends CoreMessage {
  type: 'instruction'
}

export interface BackstoryMessage extends CoreMessage {
  type: 'backstory'
}

export interface FunctionTriggerActivityMessage extends CoreMessage {
  type: 'activity'
  meta: {
    activity: {
      type: 'trigger'
      function: {
        name: string
      }
    }
  }
}

export interface FunctionRequestActivityMessage extends CoreMessage {
  type: 'activity'
  meta: {
    activity: {
      type: 'request'
      function: {
        name: string
        arguments: unknown
      }
    }
  }
}

export interface FunctionResponseActivityMessage extends CoreMessage {
  type: 'activity'
  meta: {
    activity: {
      type: 'response'
      function: {
        name: string
        arguments: unknown
        result: unknown
      }
    }
  }
}

export type ActivityMessage =
  | FunctionTriggerActivityMessage
  | FunctionRequestActivityMessage
  | FunctionResponseActivityMessage

export type Message =
  | UserMessage
  | BotMessage
  | ReasoningMessage
  | ContextMessage
  | InstructionMessage
  | BackstoryMessage
  | ActivityMessage

/**
 * Converts a string message type to a MessageType enum value
 * @throws {Error} If the message type is unknown
 */
export function getMessageType(type: string): MessageType {
  switch (type) {
    case 'user':
      return MessageType.user

    case 'bot':
      return MessageType.bot

    case 'reasoning':
      return MessageType.reasoning

    case 'context':
      return MessageType.context

    case 'instruction':
      return MessageType.instruction

    case 'backstory':
      return MessageType.backstory

    case 'checkpoint':
      return MessageType.checkpoint

    case 'activity':
      return MessageType.activity

    default:
      throw new Error(`Unknown message type ${type}`)
  }
}

/**
 * Sort messages by createdAt date, type, and id.
 */
export function getSortedMessages<
  T extends
    | { createdAt: number | string | Date }
    | { type: string }
    | { id: string },
>(messages: T[], order: 'asc' | 'desc' = 'asc'): T[] {
  const sortedMessages = messages.slice().sort((a, b) => {
    // consider the createdAt date first

    if ('createdAt' in a && a.createdAt && 'createdAt' in b && b.createdAt) {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()

      if (dateA < dateB) {
        return -1
      }

      if (dateA > dateB) {
        return 1
      }
    }

    // @note disabled because cuid should be sortable
    {
      // consider the type second, where user is first and bot is last
      // if ('type' in a && a.type && 'type' in b && b.type) {
      //   const order = [
      //     'backstory',
      //     'user',
      //     'context',
      //     'instruction',
      //     'activity',
      //     'bot',
      //   ]
      //   const indexA = order.indexOf(a.type) ?? -1
      //   const indexB = order.indexOf(b.type) ?? -1
      //   if (indexA < indexB) {
      //     return -1
      //   }
      //   if (indexA > indexB) {
      //     return 1
      //   }
      // }
    }

    // consider the id last

    if ('id' in a && a.id && 'id' in b && b.id) {
      return a.id.localeCompare(b.id)
    }

    // if nothing else is found, return 0 to keep the original order

    return 0
  })

  if (order === 'desc') {
    sortedMessages.reverse()
  }

  return sortedMessages
}

/**
 * Sorts the messages in place by createdAt date, type, and id.
 */
export function sortMessages<
  T extends
    | { createdAt: number | string | Date }
    | { type: string }
    | { id: string },
>(messages: T[], order: 'asc' | 'desc' = 'asc'): void {
  const sortedMessages = getSortedMessages(messages, order)

  messages.length = 0

  messages.push(...sortedMessages)
}

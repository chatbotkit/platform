import { baseLanguageModel } from '@/config/models'

import { MessageType } from '@/prisma/types'

import { getLast } from '@/lib/array'
import debug, { createSpan } from '@/lib/debug'
import { captureException } from '@/lib/error'
import { extractData } from '@/lib/extract.data'
import { relaxedJsonParse } from '@/lib/json'
import type { JsonSchemaObject } from '@/lib/jsonschema'
import { createChatCompletion } from '@/lib/model.provider.openai'
import { execPrompt } from '@/lib/prompt'

import detectIntentPrompt from '@/prompts/detect_intent_v4.yaml'

import type { OpenAI } from 'openai'

export const MAX_MESSAGES = 6

/**
 * Represents a message in a conversation.
 */
export interface Message {
  type: MessageType
  text: string
}

/**
 * Represents an action that can be detected from user intent.
 */
export interface Action {
  name: string
  description: string
  parameters?: Record<string, unknown>
  hintMessages?: Message[]
}

/**
 * Represents the result of an intent detection operation.
 */
interface IntentResultV1 {
  action: { name: string; input: string } | null
  tokensUsed: number
  modelUsed: string
}

/**
 * Represents the result of an intent detection operation.
 */
interface IntentResultV2 {
  action: { name: string; input: string } | null
  tokensUsed: number
  modelUsed: string
}

/**
 * Represents the result of an intent detection operation with structured input.
 */
interface IntentResultV3 {
  action: { name: string; input: Record<string, unknown> } | null
  tokensUsed: number
  modelUsed: string
}

/**
 * Options for intent detection.
 */
interface DetectIntentOptions {
  user: { id: string }
  maxMessages?: number
}

/**
 * A prompt-based intent detection implementation. The caller is expected to
 * call this function multiple times until no more actions are detected.
 *
 * @deprecated use detectIntentV3
 * @param messages - The conversation messages to analyze.
 * @param actions - The available actions to detect.
 * @param options - Configuration options including user and max messages.
 * @returns The detected action (if any), tokens used, and model used.
 */
export async function detectIntentV1(
  messages: Message[],
  actions: Action[],
  options: DetectIntentOptions
): Promise<IntentResultV1> {
  let tokensUsed = 0
  let modelUsed = baseLanguageModel

  // there must be at least one message

  if (!messages.length) {
    return { action: null, tokensUsed, modelUsed }
  }

  // the last message message must be from the user

  if (getLast(messages)?.type !== MessageType.user) {
    return { action: null, tokensUsed, modelUsed }
  }

  // there must be at least one action

  if (!actions.length) {
    return { action: null, tokensUsed, modelUsed }
  }

  // start

  const span = createSpan({ name: 'detectIntent' })

  try {
    const { user, maxMessages = MAX_MESSAGES } = options

    messages = messages.slice(0)

    messages.push(...actions.flatMap(({ hintMessages }) => hintMessages || []))

    const conversation = messages
      .filter(({ type }) =>
        ([MessageType.user, MessageType.bot] as MessageType[]).includes(type)
      )
      .slice(-maxMessages)
      .map(({ type, text }) => {
        return `<|${type.trim()}|>\n${text.trim()}`
      })
      .join('\n')

    if (!conversation) {
      return { action: null, tokensUsed, modelUsed }
    }

    // @todo further trim the text to fit certain size

    const manifest = actions
      .map(
        ({ name, description }) =>
          `* ${name.replace(/\s+/g, ' ')} - ${description.replace(/\s+/g, ' ')}`
      )
      .join('\n')

    if (!manifest) {
      return { action: null, tokensUsed, modelUsed }
    }

    // @todo further trim the text to fit certain size

    debug(`detecting intent in conversation`, { conversation, manifest }).log(
      'lib.intent.detectIntent'
    )

    let completion = JSON.stringify({ action: null })

    try {
      const response = await execPrompt(
        { ...detectIntentPrompt, user: user.id },
        { manifest, conversation }
      )

      completion = response.completion

      tokensUsed = response.tokensUsed
      modelUsed = response.modelUsed
    } catch (e) {
      await captureException(e)
    }

    const response = completion.trim()

    debug(`intent detection finished`, { response, tokensUsed, modelUsed }).log(
      'lib.intent.detectIntent'
    )

    const action = relaxedJsonParse(response)

    if (!actions?.some(({ name }) => name === action?.name)) {
      return { action: null, tokensUsed, modelUsed }
    }

    return { action, tokensUsed, modelUsed }
  } finally {
    span.finish()
  }
}

/**
 * A chat-based intent detection implementation. The caller is expected to call
 * this function multiple times until no more actions are detected.
 *
 * @deprecated use detectIntentV3
 * @param messages - The conversation messages to analyze.
 * @param actions - The available actions to detect.
 * @param options - Configuration options including user and max messages.
 * @returns The detected action (if any), tokens used, and model used.
 */
export async function detectIntentV2(
  messages: Message[],
  actions: Action[],
  options: DetectIntentOptions
): Promise<IntentResultV2> {
  debug(`detecting intent in messages`, { messages, actions }).log(
    'lib.intent.detectIntentV2'
  )

  let tokensUsed = 0
  const modelUsed = 'gpt-4o'

  // there must be at least one message

  if (!messages.length) {
    return { action: null, tokensUsed, modelUsed }
  }

  // there must be at least one action

  if (!actions.length) {
    return { action: null, tokensUsed, modelUsed }
  }

  // start

  const span = createSpan({ name: 'detectIntentV2' })

  try {
    const { user, maxMessages = MAX_MESSAGES } = options

    messages = messages.slice(0)

    messages.push(...actions.flatMap(({ hintMessages }) => hintMessages || []))

    const translatedMessages = messages
      .filter(({ type }) =>
        ([MessageType.bot, MessageType.user] as MessageType[]).includes(type)
      )
      .slice(-maxMessages)
      .reduce<OpenAI.Chat.ChatCompletionMessageParam[]>(
        (acc, { type, text }) => {
          switch (type) {
            case MessageType.bot:
              acc.push({ role: 'assistant', content: text })

              break

            case MessageType.user:
              acc.push({ role: 'user', content: text })

              break

            case MessageType.instruction:
            case MessageType.context:
              acc.push({ role: 'system', content: text })

              break
          }

          return acc
        },
        []
      )

    if (!translatedMessages.length) {
      return { action: null, tokensUsed, modelUsed }
    }

    const functions = actions.map(({ name, description, parameters }) => {
      return {
        name,
        description,

        parameters: parameters || {
          type: 'object',

          properties: {
            input: {
              type: 'string',
              description:
                'The input to pass to the action in natural language format',
            },
          },
        },
      }
    })

    let functionCall:
      | { name: string; arguments: { input?: string } }
      | null
      | undefined = undefined

    try {
      // @todo we need to migrate to stream based completion because we want to
      // cancel this request if we detect that it wont result in any action but
      // should keep in mind that not all models cam be used for streaming

      // @todo when we migrating to streaming based completion consider also
      // adding the number of input to the number of received tokens as they
      // represent the total number of tokens used

      // @todo write a simple test to detect the above by checking the number of
      // tokens being used under a certain low threshold

      const response = await createChatCompletion({
        model: modelUsed,

        messages: translatedMessages,

        functions,

        user: user.id,
      })

      functionCall = response.functionCall

      tokensUsed = response.usage.totalTokens // @todo should we add % service fee here
    } catch (e) {
      await captureException(e)
    }

    debug(`intent detection finished`, { functionCall, tokensUsed }).log(
      'lib.intent.detectIntentV2'
    )

    const action = functionCall
      ? { name: functionCall.name, input: functionCall.arguments.input || '' }
      : null

    if (!actions?.some(({ name }) => name === action?.name)) {
      return { action: null, tokensUsed, modelUsed }
    }

    return { action, tokensUsed, modelUsed }
  } finally {
    span.finish()
  }
}

/**
 * A schema-extraction-based intent detection implementation.
 *
 * Unlike v2, this version preserves structured action input as an object and
 * avoids inferring payload shape from the returned function-call arguments.
 *
 * @param messages - The conversation messages to analyze.
 * @param actions - The available actions to detect.
 * @param options - Configuration options including user and max messages.
 * @returns The detected action with structured input, tokens used, and model used.
 */
export async function detectIntentV3(
  messages: Message[],
  actions: Action[],
  options: DetectIntentOptions
): Promise<IntentResultV3> {
  debug(`detecting intent in messages with v3`, { messages, actions }).log(
    'lib.intent.detectIntentV3'
  )

  let tokensUsed = 0
  const modelUsed = 'gemini-2.5-flash'

  if (!messages.length) {
    return { action: null, tokensUsed, modelUsed }
  }

  if (!actions.length) {
    return { action: null, tokensUsed, modelUsed }
  }

  const span = createSpan({ name: 'detectIntentV3' })

  try {
    const { user, maxMessages = MAX_MESSAGES } = options

    const selectedMessages = messages
      .slice(0)
      .filter(({ type }) =>
        (
          [
            MessageType.bot,
            MessageType.user,
            MessageType.instruction,
            MessageType.context,
          ] as MessageType[]
        ).includes(type)
      )
      .slice(-maxMessages)

    selectedMessages.push(
      ...actions.flatMap(({ hintMessages }) => hintMessages || [])
    )

    if (!selectedMessages.length) {
      return { action: null, tokensUsed, modelUsed }
    }

    const actionManifest = actions
      .map(({ name, description, parameters }) => {
        const normalizedParameters = parameters || {
          type: 'object',
          properties: {
            input: {
              type: 'string',
              description:
                'The input to pass to the action in natural language format',
            },
          },
        }

        return [
          `Action: ${name}`,
          `Description: ${description}`,
          `Parameters: ${JSON.stringify(normalizedParameters)}`,
        ].join('\n')
      })
      .join('\n\n')

    const extractionMessages: Message[] = [
      {
        type: MessageType.instruction,
        text: [
          'Determine the single best matching action for the conversation.',
          'Return null when no listed action applies.',
          'Return the selected action name and the complete structured input object for that action.',
          'Available actions:',
          actionManifest,
        ].join('\n\n'),
      },
      ...selectedMessages,
    ]

    const intentSchema: JsonSchemaObject = {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: {
          type: 'string',
          enum: actions.map(({ name }) => name),
          description: 'The selected action name.',
        },
        input: {
          type: 'object',
          additionalProperties: true,
          description:
            'The structured input object for the selected action. For simple text actions, use an object with an input field.',
        },
      },
      required: ['name', 'input'],
    }

    const { data, usage } = await extractData(
      extractionMessages,
      intentSchema,
      {
        user,
        model: modelUsed,
        functionName: 'detectIntentV3',
      }
    )

    tokensUsed = usage.token

    debug(`intent detection v3 finished`, {
      data,
      tokensUsed,
      modelUsed,
    }).log('lib.intent.detectIntentV3')

    const actionName = typeof data?.name === 'string' ? data.name : null
    const actionInput =
      typeof data?.input === 'object' && data.input !== null
        ? (data.input as Record<string, unknown>)
        : null

    if (!actionName || !actionInput) {
      return { action: null, tokensUsed, modelUsed }
    }

    if (!actions.some(({ name }) => name === actionName)) {
      return { action: null, tokensUsed, modelUsed }
    }

    return {
      action: {
        name: actionName,
        input: actionInput,
      },
      tokensUsed,
      modelUsed,
    }
  } finally {
    span.finish()
  }
}

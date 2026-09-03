import { MessageType } from '@/prisma/types'

import { isRequestActivityMessage } from '@/lib/activity'
import { getStatelessConversationEngine } from '@/lib/conversation.engine'
import {
  type EngineSinkItem,
  type Sink,
  TAG_MESSAGE,
  createSinkEvent,
} from '@/lib/conversation.tag'
import debug from '@/lib/debug'
import type { JsonSchemaObject } from '@/lib/jsonschema'
import { Usage } from '@/lib/usage.model'

import type { ZodObject, ZodRawShape, z } from 'zod'
import zodToJsonSchema from 'zod-to-json-schema'

// --- Types and Interfaces ---

export interface Message {
  type: MessageType
  text: string
}

// --- Core Extraction Functionality ---

export interface ExtractDataOptions {
  user: { id: string }
  model?: string
  functionName?: string
  /**
   * Optional deadline/cancellation signal (e.g. the queue handler's hard-timeout
   * monitor signal). When provided it is wired into the extraction completion so
   * the in-flight model call aborts promptly instead of running to the hard kill.
   */
  signal?: AbortSignal
  usageMeta?: Record<string, unknown>
  usageReferences?: {
    conversationId?: string
    botId?: string
    slackIntegrationId?: string
  }
}

export interface ExtractDataResult {
  data: Record<string, unknown> | null
  usage: Usage
}

/**
 * Extracts structured data from conversation messages using AI function calling
 *
 * @param messages - Conversation messages to extract data from
 * @param schema - JSON Schema object defining the data structure to extract
 * @param options - Extraction options
 */
export async function extractData(
  messages: Message[],
  schema: JsonSchemaObject,
  options: ExtractDataOptions
): Promise<ExtractDataResult> {
  debug(`starting data extraction from messages`, {
    messages,
    schema,
    options,
  }).log('extract.data.extractData')

  const {
    user,
    model = 'gemini-2.5-flash',
    functionName = 'extractData',
    signal,
    usageMeta,
    usageReferences,
  } = options

  if (!messages.length) {
    return { data: null, usage: new Usage() }
  }

  const properties = schema.properties ?? {}
  const required = schema.required ?? []

  // @todo for defense-in-depth, we should ensure that required fields are
  // present in properties

  debug(`schema properties`, { properties, required }).log(
    'extract.data.extractData'
  )

  // @note capture function call data via sink using a container object to avoid
  // typescript inference issues

  const captured: { functionArgs: Record<string, unknown> | null } = {
    functionArgs: null,
  }

  const sink: Sink = {
    push: (async (...[type, data]) => {
      // @todo strengthen the type

      const event = createSinkEvent({
        type,
        data,
      } as EngineSinkItem)

      if (type === TAG_MESSAGE) {
        const message = data as { type: string; meta?: Record<string, unknown> }

        if (isRequestActivityMessage(message)) {
          const activity = message.meta?.activity as
            | {
                type: string
                function?: { name?: string; arguments?: unknown }
              }
            | undefined

          if (activity?.function?.name === functionName) {
            const args = activity.function.arguments

            captured.functionArgs =
              typeof args === 'object' && args !== null
                ? (args as Record<string, unknown>)
                : null
          }
        }
      }

      return event
    }) as Sink['push'],
  }

  const engine = await getStatelessConversationEngine({
    backstory:
      'You are a data extraction assistant. Use the provided function to extract structured data from the conversation.',
    model: model,

    messages: messages,

    options: {
      userId: user.id,

      sink: sink,

      usageMeta: usageMeta,
      usageReason: 'data/extract',
      usageReferences: usageReferences,

      forceFunction: functionName, // @todo use an option to force the function at later stage if necessary instead of always

      // @note extraction is single-shot: the forced call's arguments are
      // captured by the sink on the first round, so cap the sub-conversation to
      // one iteration. Without this the forced tool-choice reverts to `auto`
      // after the first call and some models (notably gemini-2.5-flash) keep
      // re-calling the function with identical args until the cycle guard stops
      // them, wasting tokens and latency until the cycle guard trips
      // ("thread cycle max reached"). One round is all this conversation needs.
      maxIterations: 1,

      functions: [
        {
          name: functionName,
          description:
            'Extracts data from conversation. Returns extracted data or null if data cannot be extracted when missing or when required fields are not present or in the wrong format.',
          parameters: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                description:
                  'Extracted data object. Omit this field if extraction failed.',
                properties: properties,
                required: required,
              },
            },
          },
          result: {
            data: 'ok',
          },
        },
      ],
    },
  })

  try {
    const { usage } = await engine.complete({ signal })

    const tokensUsed = usage.token

    debug(`schema extraction finished`, {
      capturedFunctionArgs: captured.functionArgs,
      tokensUsed: tokensUsed,
      modelUsed: model,
    }).log('extract.data.extractData')

    // @note extract the 'data' field from the captured function arguments

    const extractedData =
      captured.functionArgs !== null && 'data' in captured.functionArgs
        ? (captured.functionArgs.data as Record<string, unknown> | null)
        : null

    debug(`extracted data`, { extractedData }).log('extract.data.extractData')

    return {
      data: extractedData,
      usage: usage,
    }
  } finally {
    await engine.dispose()
  }
}

/**
 * Extracts structured data from a text input using AI function calling
 */
export async function extractDataFromInput(
  input: string,
  schema: JsonSchemaObject,
  options: ExtractDataOptions
): Promise<ExtractDataResult> {
  debug(`extracting data from input`, { input, schema, options }).log(
    'extract.data.extractDataFromInput'
  )

  if (!input.trim()) {
    return { data: null, usage: new Usage() }
  }

  const messages: Message[] = [
    {
      type: MessageType.backstory,
      text: `You are a data extraction assistant.`,
    },
    {
      type: MessageType.user,
      text: `Use the extractData function to extract data from the following input:\n\n${input}`,
    },
  ]

  debug(`constructed messages for extraction`, { messages }).log(
    'extract.data.extractDataFromInput'
  )

  const result = await extractData(messages, schema, options)

  debug(`extraction result`, { result }).log(
    'extract.data.extractDataFromInput'
  )

  return result
}

// --- Zod-based Wrappers ---

export interface ExtractDataWithSchemaResult<T> {
  data: T | null
  usage: Usage
}

/**
 * Extracts structured data from conversation messages using a Zod schema.
 * The Zod schema is converted to JSON Schema for the AI call, and the result
 * is validated using Zod for type-safe extraction.
 *
 * @param messages - Conversation messages to extract data from
 * @param schema - Zod object schema defining the data structure to extract
 * @param options - Extraction options
 * @returns Typed extraction result with data as T | null
 */
export async function extractDataWithSchema<T extends ZodRawShape>(
  messages: Message[],
  schema: ZodObject<T>,
  options: ExtractDataOptions
): Promise<ExtractDataWithSchemaResult<z.infer<ZodObject<T>>>> {
  // @note convert zod schema to json schema for the AI function call
  const jsonSchema = zodToJsonSchema(schema) as JsonSchemaObject

  debug(`converted Zod schema to JSON Schema`, {
    messages,
    jsonSchema,
    options,
  }).log('extract.data.extractDataWithSchema')

  const result = await extractData(messages, jsonSchema, options)

  debug(`extraction result`, { result }).log(
    'extract.data.extractDataWithSchema'
  )

  if (result.data === null) {
    return { data: null, usage: result.usage }
  }

  const parsed = schema.safeParse(result.data)

  if (!parsed.success) {
    debug(`zod validation failed for extracted data`, {
      error: parsed.error,
      data: result.data,
    })

    return { data: null, usage: result.usage }
  }

  return { data: parsed.data, usage: result.usage }
}

/**
 * Extracts structured data from a text input using a Zod schema.
 * The Zod schema is converted to JSON Schema for the AI call, and the result
 * is validated using Zod for type-safe extraction.
 *
 * @param input - Text input to extract data from
 * @param schema - Zod object schema defining the data structure to extract
 * @param options - Extraction options
 * @returns Typed extraction result with data as T | null
 */
export async function extractDataFromInputWithSchema<T extends ZodRawShape>(
  input: string,
  schema: ZodObject<T>,
  options: ExtractDataOptions
): Promise<ExtractDataWithSchemaResult<z.infer<ZodObject<T>>>> {
  if (!input.trim()) {
    return { data: null, usage: new Usage() }
  }

  const messages: Message[] = [
    {
      type: MessageType.backstory,
      text: `You are a data extraction assistant.`,
    },
    {
      type: MessageType.user,
      text: `Use the extractData function to extract data from the following input:\n\n${input}`,
    },
  ]

  return await extractDataWithSchema(messages, schema, options)
}

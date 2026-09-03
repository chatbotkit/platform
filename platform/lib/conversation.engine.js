// @ts-check
import '@/lib/scope.server'

import { template as t } from '@chatbotkit-dev/template'
import {
  FIVE_MINUTE_IN_MILLISECONDS,
  FIVE_MINUTE_IN_SECONDS,
  ONE_HOUR_IN_MILLISECONDS,
  ONE_MINUTE_IN_MILLISECONDS,
  getShortDate,
  getShortTime,
  getTimezone,
  timeAgo,
} from '@chatbotkit-dev/time'
import { assertUnreachable } from '@chatbotkit-dev/typescript-utils/unreachable'

import { maxAbilitiesTake } from '@/config/abilities'
import { defaultLanguageModel } from '@/config/models'

import prisma from '@/prisma/client'
import { MAX_DB_TEXT_BYTES_LENGTH } from '@/prisma/constraints'
import { MessageType, ResourceState, SkillsetVisibility } from '@/prisma/types'

import {
  getAbilityFunctionDescription,
  getAbilityFunctionInput,
  getAbilityFunctionJustification,
  getAbilityFunctionName,
  getAbilityFunctionParameters,
} from '@/lib/ability.function'
import {
  isActivityMessage,
  isResponseActivityMessage,
  isTriggerActivityMessage,
  makeActivityMessagePair,
  makeTriggerActivityMessage,
} from '@/lib/activity'
import { getSceneBackstoryAndMessages } from '@/lib/backstory'
import { canUseBot } from '@/lib/bot.access'
import { botBlockOk, getBotBlock } from '@/lib/bot.block'
import {
  getConversationDetailsField,
  getConversationDetailsFieldWithReversedPrecedence,
} from '@/lib/bot.conversation'
import { swrCache } from '@/lib/cache'
import { waitForChannelMessage } from '@/lib/channel.session'
import { canUseContact } from '@/lib/contact.access'
import { ensureTrustedContact } from '@/lib/contact.create'
import {
  getContextBot,
  getContextContact,
  getContextConversation,
  getContextNamespace,
  getContextRequestStartTime,
  getContextTimezone,
  getContextUser,
  resetContextContact,
  resetContextNamespace,
  setContextBot,
  setContextContact,
  setContextConversation,
  setContextNamespace,
} from '@/lib/context.store'
import { compactMessages } from '@/lib/conversation.compact'
import { trackIdlingConversation } from '@/lib/conversation.idle'
import { createConversationMonitorSink } from '@/lib/conversation.monitor.channel'
import {
  TAG_ABORT,
  TAG_AUDIO,
  TAG_COMPACTION_BEGIN,
  TAG_COMPACTION_END,
  TAG_COMPLETE_BEGIN,
  TAG_COMPLETE_END,
  TAG_ERROR,
  TAG_INTENT_DETECTION_BEGIN,
  TAG_INTENT_DETECTION_END,
  TAG_MESSAGE,
  TAG_OPERATION_BEGIN,
  TAG_OPERATION_END,
  TAG_PING,
  TAG_REASONING_TOKEN,
  TAG_TOKEN,
  TAG_USAGE,
  TAG_WAIT_FOR_CHANNEL_MESSAGE_BEGIN,
  TAG_WAIT_FOR_CHANNEL_MESSAGE_END,
  combineSinks,
} from '@/lib/conversation.tag'
import cuid from '@/lib/cuid'
import { canUseDataset } from '@/lib/dataset.access'
import { applyDataset } from '@/lib/dataset.apply'
import debug, { assert } from '@/lib/debug'
import { getCombinedDescription } from '@/lib/description.parse'
import { chunkUrl } from '@/lib/dsd2'
import { SafeError, captureException, errorToErrorResponse } from '@/lib/error'
import { isInExperiment } from '@/lib/experiment'
import { ABORT_ERROR_NAME, AbortError, anySignal } from '@/lib/fetch'
import { getFileObjectDownloadUrl } from '@/lib/file.storage'
import { getExternalAPIHostURL } from '@/lib/host'
import { parseTemplateInstruction } from '@/lib/instruction.template.parse'
import { unpackTemplateInstruction } from '@/lib/instruction.template.unpack'
import { getInstructionType } from '@/lib/instruction.type'
import { detectIntentV3 as detectIntent } from '@/lib/intent'
import { events } from '@/lib/it'
import { sortMessages } from '@/lib/message'
import { canUseCustomModel, canUseModel } from '@/lib/model.access'
import { getModelStore, runInModelContext } from '@/lib/model.context'
import { completeChatConversation as completeChatConversationForBedrock } from '@/lib/model.provider.bedrock.conv'
import { completeChatConversation as completeChatConversationForCloudflare } from '@/lib/model.provider.cloudflare.conv'
import { completeChatConversation as completeChatConversationForDeepseek } from '@/lib/model.provider.deepseek.conv'
import { completeChatConversation as completeChatConversationForGroq } from '@/lib/model.provider.groq.conv'
import { completeChatConversation as completeChatConversationForMistral } from '@/lib/model.provider.mistral.conv'
import { completeChatConversation as completeChatConversationForMoonshot } from '@/lib/model.provider.moonshot.conv'
import {
  DEFAULT_MAX_SETTLES,
  completeChatConversation as completeChatConversationForOpenAI,
  completeRealtimeConversation as completeRealtimeConversationForOpenAI,
  completeResponseConversation as completeResponseConversationForOpenAI,
  completeTextConversation as completeTextConversationForOpenAI,
} from '@/lib/model.provider.openai.conv'
import { completeChatConversation as completeChatConversationForOpenrouter } from '@/lib/model.provider.openrouter.conv'
import { completeChatConversation as completeChatConversationForPerplexity } from '@/lib/model.provider.perplexity.conv'
import { completeChatConversation as completeChatConversationForQwen } from '@/lib/model.provider.qwen.conv'
import { completeChatConversation as completeChatConversationForVercel } from '@/lib/model.provider.vercel.conv'
import { completeChatConversation as completeChatConversationForVertex } from '@/lib/model.provider.vertex.conv'
import { completeChatConversation as completeChatConversationForZai } from '@/lib/model.provider.zai.conv'
import {
  buildLanguageModel,
  isBedrockModel,
  isCloudflareModel,
  isDeepseekModel,
  isGroqModel,
  isMistralModel,
  isMoonshotModel,
  isOpenAIModel,
  isOpenrouterModel,
  isPerplexityModel,
  isQwenModel,
  isVercelModel,
  isVertexModel,
  isZaiModel,
  modelHasImageInputEnabled,
  modelSupportsChat,
  modelSupportsFunctions,
  modelSupportsImageInput,
  modelSupportsRealtime,
  modelSupportsResponses,
  parseAndRevealLanguageModel,
  parseLanguageModel,
} from '@/lib/model.utils'
import { detectContentAbuse } from '@/lib/moderation'
import { getSafeNamespace } from '@/lib/namespace.safe'
import { flatten } from '@/lib/object'
import { detectPiiEntities, getSafeTextAndEntities } from '@/lib/pii'
import { fallbackOnFailure, neitherTrue, wait } from '@/lib/promise'
import { computePrompt } from '@/lib/prompt'
import {
  throwBadRequest,
  throwConflict,
  throwNoSubscription,
  throwNotAuthorized,
  throwNotFound,
} from '@/lib/response'
import { Result } from '@/lib/result'
import {
  getSession as getContextSession,
  hasSession as hasContextSession,
} from '@/lib/session.context'
import { sign } from '@/lib/signature.url'
import { canUseSkillset } from '@/lib/skillset.access'
import { applySkillset } from '@/lib/skillset.apply'
import { getChunkContent } from '@/lib/skillset.chunk'
import {
  byteSlice,
  getRandomId,
  getTempId,
  joinTrimmedNotEmpty,
  replaceAllAsync,
  replaceWithMapAsync,
} from '@/lib/string'
import { getEnvironmentTools } from '@/lib/tool.environment'
import { Usage } from '@/lib/usage.model'
import { recordMessageUsage } from '@/lib/usage.record'
import { fastGetUserById } from '@/lib/user.get'
import { revealUserPlan } from '@/lib/user.plan'
import { stringify as stringifyYAML } from '@/lib/yaml'

import answerPrompt from '@/prompts/answer_v1.yaml'
import audioGeneratorPrompt from '@/prompts/audio_generator_v1.yaml'
import authGeneratorPrompt from '@/prompts/auth_generator_v1.yaml'
import batchPrompt from '@/prompts/batch_v1.yaml'
import buttonsGeneratorPrompt from '@/prompts/buttons_generator_v1.yaml'
import canvasGeneratorPrompt from '@/prompts/canvas_generator_v1.yaml'
import carouselGeneratorPrompt from '@/prompts/carousel_generator_v1.yaml'
import diligenceGeneratorPrompt from '@/prompts/diligence_v1.yaml'
import footnotesGeneratorPrompt from '@/prompts/footnotes_generator_v1.yaml'
import formGeneratorPrompt from '@/prompts/form_generator_v1.yaml'
import markdownGeneratorPrompt from '@/prompts/markdown_generator_v1.yaml'
import mathGeneratorPrompt from '@/prompts/math_generator_v1.yaml'
import mermaidGeneratorPrompt from '@/prompts/mermaid_generator_v1.yaml'
import personalizationPrompt from '@/prompts/personalization_v1.yaml'
import referencesGeneratorPrompt from '@/prompts/references_generator_v1.yaml'
import reprogrammingPrompt from '@/prompts/reprogramming_v1.yaml'
import silentPrompt from '@/prompts/silent_v1.yaml'
import timeoutMarksPrompt from '@/prompts/timeout_marks_v1.yaml'

/**
 * @note @todo READ CAREFULLY
 *
 * At the moment we are emitting all possible message types as well as a few
 * additional tags like OPERATION_BEGIN and OPERATION_END. This could become a
 * security issue if the input and output both contain information that should
 * not be exposed to the client. We need to clearly mark the session as trusted
 * somehow before sending this type of information. This is a very important
 * security issue that needs to be addressed in a generic way either here or
 * in the caller.
 */

/**
 * The Sink is a utility type that is used to send messages and errors to the
 * client. The push method accepts a type and data object. The type describes
 * the data object. The error method accepts an error object and it is used to
 * indicate that an error has occurred. That is not to say that it is not
 * possible to send an error object using the push method.
 *
 * @typedef {import('@/lib/conversation.tag').Sink} Sink
 */

/**
 * @typedef {import('@/lib/pii').KnownEntity} KnownEntity
 * @typedef {import('@/lib/pii').SafeEntity} SafeEntity
 *
 * @typedef {import('@/prisma/types').Dataset} Dataset
 *
 * @typedef {import('@/prisma/types').Skillset & { abilities: import('@/prisma/types').Ability[] }} Skillset
 *
 * @typedef {Record<string,any>} Meta
 *
 * @typedef {import('@/prisma/types').Bot} Bot
 *
 * @typedef {import('@/prisma/types').Conversation & { bot?: Bot, messages: Message[] }} Conversation
 *
 * @typedef {Record<string, any>} EngineFunctionHandlerArgs
 * @typedef {import('@/lib/conv').ConversationFunctionContext} EngineFunctionHandlerContext
 * @typedef {(args: EngineFunctionHandlerArgs, context: EngineFunctionHandlerContext) => Promise<any>} EngineFunctionHandler
 * @typedef {'start'|'end'} EngineFunctionCallPhase
 * @typedef {{start?: boolean, end?: boolean}} EngineFunctionCall
 * @typedef {{
 *   name: string,
 *   description: string,
 *   parameters: Record<string, any>,
 *   handler?: EngineFunctionHandler,
 *   hintMessages?: Message[],
 *   icon?: string,
 *   call?: EngineFunctionCall
 * }} EngineFunction
 *
 * @typedef {{
 *   type: 'bot',
 *   token: string
 * }} Token
 *
 * @typedef {{
 *   type: 'bot',
 *   token: string
 * }} ReasoningToken
 *
 * @typedef {{
 *   id?: string,
 *   type: MessageType,
 *   text: string,
 *   meta?: Meta,
 *   createdAt?: Date
 * }} Message
 *
 * @typedef {Omit<Message,'createdAt'> & {
 *   createdAt: Date
 * }} StampedMessage
 *
 * @typedef {Message & { id: string }} SavedMessage
 */

/**
 * @typedef {import('@/lib/conversation.tag').CompleteReason} CompleteReason
 */

/**
 * The normalized error behind a `reason: 'error'` completion, as produced by
 * `errorToErrorResponse` - safe to surface (internal details such as the
 * provider request body are already stripped).
 *
 * @typedef {{ code: string, message: string } | undefined} CompleteError
 */

/**
 * @typedef {import('@/lib/conversation.features').Feature} Feature
 */

export const DATASET_QUERY_FUNCTION_NAME = 'query'

/**
 * Unwraps the search phrase produced for the synthetic dataset `query` function.
 *
 * `getAbilityFunctionInput` serialises the validated fields to a JSON object
 * string (e.g. `{"query":"..."}`), but `applyDataset` expects a bare search
 * phrase. Pull the single `query` field back out, tolerating a plain string or
 * empty input so a malformed payload degrades to an empty search rather than
 * searching for literal JSON.
 *
 * @param {string} input
 * @returns {string}
 */
export function unwrapDatasetQuery(input) {
  if (!input) {
    return ''
  }

  try {
    const parsed = JSON.parse(input)

    if (parsed && typeof parsed === 'object') {
      return typeof parsed.query === 'string' ? parsed.query : ''
    }

    // @note a bare JSON string (e.g. `"hello"`) parses to a primitive - use it
    return typeof parsed === 'string' ? parsed : input
  } catch {
    // @note not JSON - treat the raw value as the search phrase
    return input
  }
}

export const MAX_PROCESS_MESSAGE_TAKE = 5 // @note must be an integer (i.e. not Infinity, etc)
export const MAX_COMPLETE_MESSAGE_TAKE = 1000 // @note must be an integer (i.e. not Infinity, etc)

export const MIN_COMPACT_TOKENS_THRESHOLD = 50000
export const MIN_COMPACT_MESSAGES_THRESHOLD = 20

/**
 * @param {unknown} args
 * @returns {string|undefined}
 */
function getOperationActionJustification(args) {
  if (typeof args === 'object' && args !== null) {
    if (
      'justification' in args &&
      typeof args.justification === 'string' &&
      args.justification
    ) {
      return args.justification
    }
  }

  return undefined
}

/**
 * Grafts the activity `justification` parameter onto a tool/function schema when
 * the justification feature is enabled.
 *
 * Ability, dataset and skillset functions get their justification parameter from
 * `getAbilityFunctionParameters`. Tools that bypass that path carry an opaque,
 * caller-supplied schema - installed environment tools (skillset/pack/MCP) and
 * custom functions - so the parameter has to be grafted on here instead. Without
 * it the model is never asked for a justification and
 * `getOperationActionJustification` always reads back `undefined`, silently
 * dropping justifications for every such tool.
 *
 * Returns the parameters to advertise to the model plus an `extractInput` that
 * recovers the real tool input from the model's args, stripping the injected
 * justification so it never leaks into the underlying call (MCP request, ability
 * execution, channel payload, etc.).
 *
 * @param {import('@/lib/jsonschema').JsonSchema | Record<string, unknown>} inputSchema
 * @param {{ includeJustification?: boolean }} [options]
 * @returns {{
 *   parameters: Record<string, any>,
 *   extractInput: (args: unknown) => unknown,
 * }}
 */
function buildJustificationFunctionSchema(inputSchema, options) {
  const includeJustification = !!options?.includeJustification

  if (!includeJustification) {
    // @note feature off: advertise the tool schema verbatim and pass the model
    // args straight through - a caller-supplied `justification` (if any) is just
    // a normal field, exactly as it behaved before this feature existed.
    return {
      parameters: inputSchema,
      extractInput: (args) => args,
    }
  }

  const justificationProperty = {
    type: 'string',
    title: 'Justification for the action',
  }

  const schema = /** @type {Record<string, unknown>} */ (
    inputSchema && typeof inputSchema === 'object' ? inputSchema : {}
  )

  const existingProperties =
    schema.properties && typeof schema.properties === 'object'
      ? /** @type {Record<string, unknown>} */ (schema.properties)
      : /** @type {Record<string, unknown>} */ ({})

  // @note if the tool already declares its own top-level `justification` field
  // the two collide, so nest the whole tool schema under `input` and keep the
  // activity justification beside it (mirrors getAbilityFunctionParameters rule
  // 4), then unwrap `input` before invoking the tool.

  const clashes = 'justification' in existingProperties

  if (clashes) {
    return {
      parameters: {
        type: 'object',
        title: 'Action request',

        properties: {
          input: inputSchema,
          justification: justificationProperty,
        },

        required: ['input', 'justification'],
        additionalProperties: false,
      },

      extractInput: (args) => {
        if (args && typeof args === 'object' && 'input' in args) {
          return /** @type {Record<string, unknown>} */ (args).input
        }

        return args
      },
    }
  }

  // @note common case: justification sits beside the tool's own fields. Preserve
  // the original schema (additionalProperties, $schema, etc.) and only graft the
  // justification property and requirement on top.

  const existingRequired = Array.isArray(schema.required) ? schema.required : []

  return {
    parameters: {
      type: 'object',
      ...schema,

      properties: {
        ...existingProperties,
        justification: justificationProperty,
      },

      required: [...existingRequired, 'justification'],
    },

    extractInput: (args) => {
      if (args && typeof args === 'object' && 'justification' in args) {
        const { justification: _justification, ...rest } =
          /** @type {Record<string, unknown>} */ (args)

        return rest
      }

      return args
    },
  }
}

/**
 * Refuse to run a blocked bot. A block is a temporary, policy- or admin-driven
 * soft lock (see lib/bot.block) enforced at the completion core so every
 * generation path is covered regardless of how the engine was constructed
 * (including direct engine-class use). The bot is read from context. No-op when
 * there is no bot in play; throws (409) when the bot is currently blocked.
 */
export async function assertBotNotBlocked() {
  const bot = getContextBot()

  if (!bot?.id) {
    return
  }

  if (await botBlockOk(bot.id)) {
    return
  }

  // @note only reached when blocked; fetch the reason for the response. Switch
  // throwConflict -> throwTooManyRequests to use 429 instead of 409.
  const block = await getBotBlock(bot.id)

  throwConflict(block?.reason ?? 'This bot is temporarily disabled.')
}

/**
 * This is a base utility type for engine classes.
 */
export class Engine {
  // @note does not have a constructor by design

  /**
   * @typedef {{
   *   usage: Usage,
   *   entities: SafeEntity[],
   *   messages: Message[]
   * }} ProcessResponse
   *
   * The function is responsible for processing incoming messages. This is
   * typically used in the context of sending messages to the conversation.
   *
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<ProcessResponse>}
   * @throws {Error}
   * @abstract
   */
  process(options) {
    options

    throw new Error(`Not implemented`)
  }

  /**
   * @typedef {{
   *   usage: Usage,
   *   messages: Message[],
   *   reason: CompleteReason,
   *   error?: CompleteError
   * }} CompleteResponse
   *
   * The function is responsible for completing the conversation. This is
   * typically used in the context of receiving messages from the conversation.
   *
   * @param {{ signal?: AbortSignal, modality?: 'text' | 'audio' }} [options]
   * @returns {Promise<CompleteResponse>}
   * @throws {Error}
   * @abstract
   */
  complete(options) {
    options

    throw new Error(`Not implemented`)
  }

  /**
   * @typedef {{
   *   usage: Usage,
   *   messages: Message[],
   *   result: any,
   *   meta?: Record<string,any>
   * }} ApplyResponse
   *
   * The function is responsible for applying a specific function/tool in the
   * conversation context.
   *
   * @param {{ name: string, input: Record<string,any>, signal?: AbortSignal }} options
   * @returns {Promise<ApplyResponse>}
   * @throws {Error}
   * @abstract
   */
  apply(options) {
    options

    throw new Error(`Not implemented`)
  }

  /**
   * @typedef {{
   *   functions: Pick<EngineFunction,'name'|'description'|'parameters'|'icon'|'call'>[]
   * }} SnapshotResponse
   *
   * The function is responsible for returning a serializable snapshot of the
   * current conversation runtime state.
   *
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<SnapshotResponse>}
   * @throws {Error}
   * @abstract
   */
  snapshot(options) {
    options

    throw new Error(`Not implemented`)
  }

  /**
   * @typedef {ProcessResponse & {}} SendResponse
   *
   * A utility function to send a message.
   *
   * @param {string} text
   * @param {{type?: MessageType, signal?: AbortSignal}} [options]
   * @returns {Promise<SendResponse>}
   * @throws {Error}
   * @abstract
   */
  send(text, options) {
    text
    options

    throw new Error(`Not implemented`)
  }

  /**
   * @typedef {CompleteResponse & {text: string}} ReceiveResponse
   *
   * A utility function to receive a message.
   *
   * @param {{ signal?: AbortSignal, context?: Record<string, any>, modality?: 'text' | 'audio' }} [options]
   * @returns {Promise<ReceiveResponse>}
   * @throws {Error}
   * @abstract
   */
  receive(options) {
    options

    throw new Error(`Not implemented`)
  }

  /**
   * A utility function to steer a conversation by sending a message and
   * receiving the response as one interruptible turn.
   *
   * @param {string} text
   * @param {{type?: MessageType, signal?: AbortSignal, context?: Record<string, any>}} [options]
   * @returns {Promise<ReceiveResponse>}
   * @throws {Error}
   * @abstract
   */
  steer(text, options) {
    text
    options

    throw new Error(`Not implemented`)
  }

  /**
   * A utility function to process realtime audio.
   *
   * @param {{
   *   data: string,
   *   format: {
   *     encoding: 'pcm16',
   *     sampleRate: number,
   *     channels: number,
   *   }
   * }} data
   * @param {{ signal?: AbortSignal }} [options]
   * @returns {Promise<void>}
   * @throws {Error}
   * @abstract
   */
  audio(data, options) {
    data
    options

    throw new Error(`Not implemented`)
  }

  /**
   * Frees runtime resources owned by this engine.
   *
   * @returns {Promise<void>}
   * @throws {Error}
   * @abstract
   */
  async dispose() {
    throw new Error(`Not implemented`)
  }
}

/**
 * This is the core engine class which provides a standard interface for all
 * engine types.
 */
export class CoreEngine extends Engine {
  /**
   * @type {null | {
   *   abortController: AbortController,
   *   promise: Promise<ReceiveResponse>
   * }}
   */
  #steerActiveTurn = null

  /**
   * @type {null | {
   *   text: string,
   *   options?: {type?: MessageType, signal?: AbortSignal},
   *   resolve: (value: ReceiveResponse) => void,
   *   reject: (reason?: any) => void,
   * }}
   */
  #steerPendingTurn = null

  /**
   * @type {null | Promise<void>}
   */
  #steerDrainPromise = null

  /**
   * Cleanup callbacks that detach the timeout-mark signal listeners (see the
   * `timeoutMarks` feature). Invoked on dispose.
   *
   * @type {Array<() => void>}
   */
  #markSignalCleanups = []

  /**
   * Ephemeral, in-memory-only messages surfaced to the model on every round
   * of the in-flight completion but never persisted to the conversation log.
   *
   * @type {Message[]}
   */
  liveMessages = []

  /**
   * Drains ephemeral in-flight messages after a completion round consumes
   * them.
   *
   * @returns {Message[]}
   */
  drainLiveMessages() {
    const pending = this.liveMessages

    this.liveMessages = []

    return pending
  }

  /**
   * @typedef {{
   *   sessionId?: string,
   *   userId: string,
   *   backstory?: string,
   *   backstoryExtra?: string,
   *   model?: string,
   *   privacy?: boolean,
   *   moderation?: boolean,
   *   datasetId?: string,
   *   skillsetId?: string,
   *   entities?: KnownEntity[],
   *   messages?: Message[],
   *   functions?: {name: string, description: string, parameters: Record<string,any>, result?: {data?: any, channel?: string}, call?: {start?: boolean, end?: boolean}}[],
   *   internalFunctions?: {name: `_${string}`, description: string, parameters: Record<string,any>, handler: (...args: any[]) => any}[],
   *   forceFunction?: string,
   *   features?: Feature[],
   *   inlineDatasets?: {name?: string, description?: string, records: {text: string, meta?: Record<string,any>}[]}[],
   *   inlineSkillsets?: {name?: string|null, description?: string|null, abilities: (import('@/schemas/inlineExtensions').InlineAbility & {state?: import('@/prisma/types').ResourceState, secrets?: import('@/lib/secret.value').InlineSecretSource})[]}[],
   *   blockedRecords?: string[],
   *   blockedAbilities?: string[],
   *   meta?: Meta,
   *   usageMeta?: Meta,
   *   usageReason?: string,
   *   usageReferences?: {conversationId?: string, botId?: string},
   *   sink?: Sink,
   *   debug?: boolean,
   *   bpacc?: boolean,
   *   maxIterations?: number,
   *   maxContinuations?: number,
   *   callStats?: { calls: number, budgetWarned?: boolean },
   *   maxCalls?: number,
   *   cycleStats?: { detected: number },
   *   maxCycles?: number,
   *   signal?: AbortSignal,
   *   markSignals?: AbortSignal[],
   *   yieldSignal?: AbortSignal
   * }} CoreEngineOptions
   *
   * @param {CoreEngineOptions} options
   */
  constructor(options) {
    super()

    this.sessionId = options.sessionId
    this.userId = options.userId

    this.backstory = options.backstory
    this.backstoryExtra = options.backstoryExtra

    this.model = options.model || defaultLanguageModel

    this.datasetId = options.datasetId
    this.skillsetId = options.skillsetId

    this.privacy = options.privacy ?? false
    this.moderation = options.moderation ?? false

    this.entities = options.entities || []

    this.messages = options.messages || []

    this.functions = options.functions
    this.internalFunctions = options.internalFunctions

    this.forceFunction = options.forceFunction

    // @note defensive copy so the auto-injection below does not mutate the
    // caller's features array
    this.features = /** @type {Feature[]}*/ ([...(options.features || [])])

    {
      let modelConfig

      try {
        modelConfig = parseAndRevealLanguageModel(this.model).config
      } catch {
        modelConfig = null
      }

      if (
        modelConfig?.thresholdStrategy === 'compact' &&
        !this.features.some((feature) => feature.name === 'compact')
      ) {
        this.features.push({
          name: 'compact',
          options: {
            tokens: modelConfig.maxTokens ?? 0,
            messages: modelConfig.interactionMaxMessages ?? 0,
          },
        })
      }
    }

    this.inlineDatasets = options.inlineDatasets
    this.inlineSkillsets = options.inlineSkillsets

    this.blockedRecords = options.blockedRecords || []
    this.blockedAbilities = options.blockedAbilities || []

    this.meta = options.meta || {}

    this.usageMeta = options.usageMeta || {}
    this.usageReason = options.usageReason
    this.usageReferences = options.usageReferences || {}

    this.sink = options.sink

    this.debug = options.debug || false

    this.bpacc = options.bpacc

    // @note these options control the conv function mechanics. callStats /
    // cycleStats let the caller seed the running tool-call and cycle-detection
    // counts and read them back after a run - the conv function mutates these
    // objects in place. A durable, step-per-chunk runner (the task workflow)
    // carries the totals in its own state across chunks so a budget bounds the
    // whole task, not just one step. Left undefined the conv function allocates
    // fresh per-run counters (the default for interactive completions). Each
    // stat is grouped with its limit, mirroring ConversationOptions.
    this.maxIterations = options.maxIterations
    this.maxContinuations = options.maxContinuations
    this.callStats = options.callStats
    this.maxCalls = options.maxCalls
    this.cycleStats = options.cycleStats
    this.maxCycles = options.maxCycles

    this.signal = options.signal

    // @note cooperative soft-yield signal: consulted by the conv function at
    // iteration boundaries (not mid-stream like `signal`). When tripped, the
    // agentic loop finishes the current round and stops with reason 'iteration'.
    this.yieldSignal = options.yieldSignal

    /**
     * @type {null | {
     *   abortController: AbortController,
     *   promise: Promise<ReceiveResponse>
     * }}
     */
    this.#steerActiveTurn = null

    /**
     * @type {undefined | {
     *   push(data: import('@/lib/conv').AudioItem): void,
     *   start(): Promise<void>
     * }}
     */
    this.audioCompletion = undefined

    /**
     * @type {null | {
     *   text: string,
     *   options?: {type?: MessageType, signal?: AbortSignal},
     *   resolve: (value: ReceiveResponse) => void,
     *   reject: (reason?: any) => void,
     * }}
     */
    this.#steerPendingTurn = null

    /** @type {null | Promise<void>} */
    this.#steerDrainPromise = null

    /** @type {object} */
    this.convContext = {}

    /** @type {import('@/lib/conv').ConversationSink} */
    this.convSink = {
      push: async (type, data) => {
        const item = /** @type {import('@/lib/conv').Item} */ ({ type, data })

        await this.handleConversationSinkItem(item)
      },
    }

    this.instance = getRandomId('in-')
    this.iteration = getRandomId('it-')

    if (this.backstory) {
      const {
        backstory: sceneBackstory,

        messages: sceneMessages,

        datasets: sceneDatasets,
        skillsets: sceneSkillsets,
      } = getSceneBackstoryAndMessages(this.backstory)

      this.backstory = sceneBackstory

      if (sceneMessages.length) {
        this.messages = [...sceneMessages, ...this.messages]
      }

      if (sceneDatasets.length) {
        this.inlineDatasets ??= []

        for (const sceneDataset of sceneDatasets) {
          if (sceneDataset.records?.length) {
            this.inlineDatasets.push({
              name: sceneDataset.name,
              description: sceneDataset.description,
              records: sceneDataset.records.map(({ text }) => ({ text })),
            })
          }
        }
      }

      if (sceneSkillsets.length) {
        this.inlineSkillsets ??= []

        for (const sceneSkillset of sceneSkillsets) {
          if (sceneSkillset.abilities?.length) {
            this.inlineSkillsets.push({
              name: sceneSkillset.name,
              description: sceneSkillset.description,
              abilities: sceneSkillset.abilities.map(
                ({ name, description, instruction }) => ({
                  name: name || '',
                  description: description || '',
                  instruction: instruction || '',
                })
              ),
            })
          }
        }
      }
    }

    if (this.getFeature('noFunctions')) {
      debug('removing all functions due to noFunctions feature').log(
        'conversation.engine.CoreEngine'
      )

      this.functions = undefined
    }

    if (this.getFeature('noInlineDatasets')) {
      debug('removing all inline datasets due to noInlineDatasets feature').log(
        'conversation.engine.CoreEngine'
      )

      this.inlineDatasets = undefined
    }

    if (this.getFeature('noInlineSkillsets')) {
      debug(
        'removing all inline skillsets due to noInlineSkillsets feature'
      ).log('conversation.engine.CoreEngine')

      this.inlineSkillsets = undefined
    }

    if (this.getFeature('bpacc')) {
      debug('enabling BPACC mode due to bpacc feature').log(
        'conversation.engine.CoreEngine'
      )

      this.bpacc = true
    }

    if (this.getFeature('noFeatures')) {
      debug('removing all features due to noFeatures feature').log(
        'conversation.engine.CoreEngine'
      )

      this.features = /** @type {Feature[]}*/ ([])
    }

    if (this.getFeature('timeoutMarks')) {
      if (Array.isArray(options.markSignals)) {
        this.#registerTimeoutMarks(options.markSignals)
      }
    }

    if (this.datasetId) {
      this.features.push({
        name: 'dataset',
      })
    }

    if (this.skillsetId) {
      this.features.push({
        name: 'skillset',
      })
    }

    // @note chunking is disabled by default but can be explicitly enabled via
    // the 'chunking' feature - when chunking is enabled, large skillset
    // responses are split into chunks and the _readChunk function is exposed

    if (this.getFeature('chunking')) {
      this.internalFunctions ??= []

      this.internalFunctions.push({
        name: '_readChunk',
        description: t`
          Retrieves a chunk of data from a large response that was split into
          multiple chunks. Use this when a function returns a chunked data with
          an isChunked=true flag. You can retrieve individual chunks using
          their chunk ID from the chunks array.
        `,

        parameters: {
          type: 'object',
          properties: {
            chunkId: {
              type: 'string',
              description: t`
                The ID of the chunk to retrieve (from the chunks array in the 
                chunked response)
              `,
            },
          },
          required: ['chunkId'],
        },

        async handler({ chunkId }) {
          debug(`_readChunk`, { chunkId }).log(
            'conversation.engine.CoreEngine._readChunk'
          )

          const content = await getChunkContent(chunkId)

          if (content === null) {
            return { error: 'Chunk not found or expired' }
          }

          return { content }
        },
      })
    }

    if (this.getFeature('memory')) {
      this.inlineSkillsets ??= []

      this.inlineSkillsets.push({
        name: 'User Memory',
        description: t`
          User memory management abilities
          ---
          Utilize the memory management tools to remember and retrieve important memories about the current user.

          These tools must be utilized sparingly and only when absolutely necessary.
        `,
        abilities: [
          {
            // @note get this information from a type-generated file

            name: 'Search User Memories',
            description:
              'Search for important information about the current user that could be useful in the current conversation.',

            instruction: stringifyYAML({
              template: 'memory/search[contact]',
              parameters: {},
            }),
          },
          {
            // @note get this information from a type-generated file

            name: 'List User Memories',
            description: 'List important information about the current user',

            instruction: stringifyYAML({
              template: 'memory/list[contact]',
              parameters: {},
            }),
          },
          {
            // @note get this information from a type-generated file

            name: 'Create User Memory',
            description:
              'Store important information about the current user that could be useful in future conversations.',

            instruction: stringifyYAML({
              template: 'memory/create[contact]',
              parameters: {},
            }),
          },
          {
            // @note get this information from a type-generated file

            name: 'Update User Memory',
            description:
              'Update important information about the current user in memory.',
            instruction: stringifyYAML({
              template: 'memory/update[contact][by-id]',
              parameters: {},
            }),
          },
          {
            // @note get this information from a type-generated file

            name: 'Delete User Memory',
            description:
              'Remove important information about the current user from memory.',

            instruction: stringifyYAML({
              template: 'memory/delete[contact][by-id]',
              parameters: {},
            }),
          },
        ],
      })
    }

    if (this.getFeature('task')) {
      this.inlineSkillsets ??= []

      this.inlineSkillsets.push({
        name: 'User Task',
        description: 'User task management abilities',
        abilities: [
          {
            // @note get this information from a type-generated file

            name: 'List User Tasks',
            description: 'List tasks assigned to the current user',
            instruction: stringifyYAML({
              template: 'task/list[contact]',
              parameters: {},
            }),
          },
          {
            // @note get this information from a type-generated file

            name: 'Create User Task',
            description: 'Create a new task for the current user',
            instruction: stringifyYAML({
              template: 'task/create[contact]',
              parameters: {},
            }),
          },
          {
            // @note get this information from a type-generated file

            name: 'Update User Task',
            description: 'Update an existing task for the current user',
            instruction: stringifyYAML({
              template: 'task/update[contact][by-bot-id]',
              parameters: {},
            }),
          },
          {
            // @note get this information from a type-generated file

            name: 'Delete User Task',
            description: 'Delete a task assigned to the current user',
            instruction: stringifyYAML({
              template: 'task/delete[contact][by-bot-id]',
              parameters: {},
            }),
          },
          {
            // @note get this information from a type-generated file

            name: 'Run User Task',
            description: 'Run a task assigned to the current user',
            instruction: stringifyYAML({
              template: 'task/run[contact][by-bot-id]',
              parameters: {},
            }),
          },
        ],
      })
    }

    if (this.getFeature('time')) {
      this.inlineSkillsets ??= []

      this.inlineSkillsets.push({
        name: 'Time Awareness',
        description: t`
          Date and time awareness abilities
          ---
          Use these tools to obtain the current date and time. Always call a tool
          to get the current date and time instead of guessing or relying on
          training data, as your internal clock may be inaccurate or stale.
        `,
        abilities: [
          {
            // @note get this information from a type-generated file

            name: 'Get Current Date And Time',
            description:
              'Get the current date and time in one requested format, with optional timezone override. Defaults to the conversation timezone and returns a single value in datetime, date, time, iso, or unix format.',

            instruction: stringifyYAML({
              template: 'time/now',
              parameters: {},
            }),
          },
        ],
      })
    }

    if (this.getFeature('batch')) {
      this.inlineSkillsets ??= []

      this.inlineSkillsets.push({
        name: 'Batch Operations',
        description: 'Operations for batch modes',
        abilities: [
          {
            // @note get this information from a type-generated file

            name: '_success',
            description:
              'Exit the current operation by marking the current operation as successful - must be called as the last operation once all tasks are completed',

            instruction: stringifyYAML({
              template: 'abort[success]',
            }),
          },
          {
            // @note get this information from a type-generated file

            name: '_failure',
            description:
              'Exit the current operation by marking the current operation as failure - must be called as the last operation if an unrecoverable error is encountered',

            instruction: stringifyYAML({
              template: 'abort[failure]',
            }),
          },
        ],
      })
    }

    if (this.getFeature('silent')) {
      // pass
    }

    if (this.getFeature('reprogramming')) {
      const bot = getContextBot()

      // @note only inject reprogramming abilities when a bot is available in
      // context, as the abilities require a concrete bot ID to operate on

      if (bot) {
        this.inlineSkillsets ??= []

        this.inlineSkillsets.push({
          name: 'Bot Reprogramming',
          description: computePrompt(reprogrammingPrompt, {}),
          abilities: [
            {
              name: 'Read Bot Backstory',
              description:
                'Read the current backstory (system instructions) of the bot',

              instruction: stringifyYAML({
                template: 'bot/backstory/read[by-id]',
                parameters: {
                  botId: bot.id,
                },
              }),
            },
            {
              name: 'Write Bot Backstory',
              description:
                'Update the backstory (system instructions) of the bot with new content',

              instruction: stringifyYAML({
                template: 'bot/backstory/write[by-id]',
                parameters: {
                  botId: bot.id,
                },
              }),
            },
          ],
        })
      }
    }

    if (this.getFeature('vision')) {
      if (modelSupportsImageInput(this.model)) {
        if (!modelHasImageInputEnabled(this.model)) {
          const { name, config } = parseLanguageModel(this.model)

          config.image = true

          this.model = buildLanguageModel(name, config)

          this.backstoryExtra = t`
            ${this.backstoryExtra} ${t.when(!!this.backstoryExtra)}

            # Vision Capabilities

            You have access to tools/functions for image analysis and understanding. Use them to analyze and understand images.
          `
        }
      } else {
        this.backstoryExtra = t`
          ${this.backstoryExtra} ${t.when(!!this.backstoryExtra)}

          # Vision Capabilities

          You have access to tools/functions for image analysis and understanding. Use them to analyze and understand images.
        `

        this.inlineSkillsets ??= []

        this.inlineSkillsets.push({
          name: 'Vision',
          description: 'Image analysis and understanding capabilities',
          abilities: [
            {
              // @note get this information from a type-generated file

              name: 'Describe Image',
              description: 'Describe the content of an image URL',

              instruction: stringifyYAML({
                template: 'view/describe',
              }),
            },
          ],
        })
      }
    }

    if (this.getFeature('attachments')) {
      this.inlineSkillsets ??= []

      this.backstoryExtra = t`
        ${this.backstoryExtra} ${t.when(!!this.backstoryExtra)}

        # Attachment Capabilities

        You have access to tools/functions for analyzing and extracting content from file attachments.

        IMPORTANT: Whenever one or more attachments are provided you MUST read and process every one of them with these tools before you respond, even when the user does not explicitly ask you to. Never claim you cannot read an attachment without first attempting to read it, and never ask the user to transcribe, describe, or paste content that you can extract yourself. This is a hard requirement.

        To use these tools, look for the attachment type first and then select the appropriate tool.

        The Read Attachment tool works on any attachment: it extracts text from documents, describes images, and transcribes audio files (including voice notes). Always try it before concluding that an attachment cannot be read.

        CSV, JSON and Excel files can be queried using SQL queries to filter, aggregate, and analyze the data.

        Other file types can be read to extract text content.

        When appropriate, you can also read CSV, JSON and Excel files to extract text content if SQL queries are not needed or previous SQL queries did not return the information you were looking for.
      `

      this.inlineSkillsets.push({
        name: 'Attachments',
        description: 'File attachment analysis and extraction capabilities',
        abilities: [
          {
            // @note get this information from a type-generated file

            name: 'Read Attachment',
            description:
              'Read and extract content from uploaded file attachments. Locate the corresponding tool call for the attachment information. Handles text and document files (extracts text), image files (analyzes and describes them), and audio files including voice notes (transcribes them to text). Video files are not supported.',
            instruction: stringifyYAML({
              template: 'attachment/read',
            }),
          },
          {
            // @note get this information from a type-generated file

            name: 'Execute File SQL Query',
            description:
              'Execute SQL queries on structured data files (CSV, Excel, JSON) to filter, aggregate, and analyze data.',
            instruction: stringifyYAML({
              template: 'url/sql',
            }),
          },
        ],
      })
    }

    if (this.getFeature('web')) {
      // @todo parse the options with zod

      const webFeature = this.getFeature('web')

      let includeWebSearch = true
      let includeWebFetch = false

      if (
        typeof webFeature?.options === 'object' &&
        webFeature?.options !== null
      ) {
        if (typeof webFeature.options.search === 'boolean') {
          includeWebSearch = webFeature.options.search
        }

        if (typeof webFeature.options.fetch === 'boolean') {
          includeWebFetch = webFeature.options.fetch
        }
      }

      this.inlineSkillsets ??= []

      const webAbilities = []

      if (includeWebSearch) {
        webAbilities.push({
          // @note get this information from a type-generated file

          name: 'Search Web',
          description: 'Search the web for specific keywords',

          instruction: stringifyYAML({
            template: 'search/web',
          }),
        })
      }

      if (includeWebFetch) {
        webAbilities.push({
          // @note get this information from a type-generated file

          name: 'Fetch Web Page',
          description:
            'Fetch the content of a web page using a URL and convert it to text',

          instruction: stringifyYAML({
            template: 'fetch/text/get',
          }),
        })
      }

      if (webAbilities.length > 0) {
        this.inlineSkillsets.push({
          name: 'Web',
          description: 'Web search and fetch capabilities',
          abilities: webAbilities,
        })
      }
    }

    if (this.getFeature('bash')) {
      this.inlineSkillsets ??= []

      this.inlineSkillsets.push({
        name: 'Bash',
        description: 'Shell command execution capabilities',
        abilities: [
          {
            name: 'Execute Shell Command',
            description:
              'Execute a bash shell command or script in the sandbox environment',

            instruction: stringifyYAML({
              template: 'shell/exec',
            }),
          },
          {
            name: 'Read/Write File',
            description:
              'Read or write file content in the shell sandbox environment',

            instruction: stringifyYAML({
              template: 'shell/rw',
            }),
          },
          {
            name: 'Import URL to Shell',
            description:
              'Import data from a URL and save it to a file in the shell environment',

            instruction: stringifyYAML({
              template: 'shell/import',
            }),
          },
        ],
      })
    }

    if (this.getFeature('dataset')) {
      // @todo add code here
    }

    if (this.getFeature('skillset')) {
      // @todo add code here
    }

    // @note the skills feature allows passing skill definitions that are added to the system prompt
    if (this.getFeature('skills')) {
      const skillsFeature = this.getFeature('skills')

      if (
        typeof skillsFeature?.options === 'object' &&
        skillsFeature?.options !== null &&
        skillsFeature.options.skills.length
      ) {
        const skillsContent = skillsFeature.options.skills
          .map((skill) => {
            return t`
# Skills

Use the following skills when appropriate. To use a skill, read the main skill path defined in the location field which will point to a specific instruction how to use the skill, and then follow the instructions defined in the description field to use the skill correctly.

<skill>
  <name>${skill.name}</name>
  <description>${skill.description}</description>
  <location>${skill.path}</location>
</skill>`.trim()
          })
          .join('\n')

        this.backstoryExtra = t`
          ${this.backstoryExtra} ${t.when(!!this.backstoryExtra)}

<available_skills>
${skillsContent}
</available_skills>
        `
      }
    }

    /** @type {Promise<Dataset|null>|null} */
    this.datasetPromise = null

    /** @type {Promise<Skillset|null>|null} */
    this.skillsetPromise = null

    // @todo if no secret manager, set the ephemeral secret manager
  }

  /**
   * @override
   *
   * Frees runtime resources owned by this engine.
   *
   * @returns {Promise<void>}
   */
  async dispose() {
    // @note detach timeout-mark listeners so a late-firing mark cannot record
    // into a disposed engine
    for (const cleanup of this.#markSignalCleanups) {
      cleanup()
    }

    this.#markSignalCleanups = []

    /**
     * @param {any} value
     * @param {Set<any>} seen
     * @returns {Promise<void>}
     */
    const disposeValue = async (value, seen = new Set()) => {
      if (!value || typeof value !== 'object' || seen.has(value)) {
        return
      }

      seen.add(value)

      if (typeof value.dispose === 'function') {
        await value.dispose()

        return
      }

      if (typeof value.close === 'function') {
        await value.close()

        return
      }

      if (typeof value.terminate === 'function') {
        await value.terminate()

        return
      }

      for (const child of Object.values(value)) {
        await disposeValue(child, seen)
      }
    }

    await disposeValue(this.convContext)
  }

  /**
   * Gets a feature by name or return null if the feature is not found.
   *
   * @template {Feature['name']} TName
   * @param {TName} name
   * @returns {Extract<Feature, {name: TName}>|null}
   */
  getFeature(name) {
    return /** @type {Extract<Feature, {name: TName}>|null} */ (
      this.features.find((feature) => feature.name === name) || null
    )
  }

  /**
   * Returns if the engine runs in background processing mode.
   *
   * @returns {boolean}
   */
  isBackground() {
    return this.getFeature('batch') || this.getFeature('silent') ? true : false
  }

  /**
   * Parses and reveals the language model. The reason we do two steps as a
   * single steps is because we want to handle when the model proxy to the
   * original model.
   *
   * @returns {ReturnType<typeof parseAndRevealLanguageModel>}
   */
  breakdownLanguageModel() {
    debug(`parsing and revealing language model`, { model: this.model })

    return parseAndRevealLanguageModel(this.model)
  }

  /**
   * Returns a client id that can be used to identify the user in the context
   * of the model. This is typically used to track usage, abuse, etc.
   *
   * @return {string}
   */
  getClientId() {
    const parts = [this.userId]

    const contact = getContextContact()

    if (contact?.id) {
      parts.push(`contact[${contact.id}]`)
    }

    return parts.join('/')
  }

  /**
   * @param {ReturnType<CoreEngine['breakdownLanguageModel']>['config']} modelConfig
   * @param {EngineFunction[]} functions
   * @return {string|undefined}
   * @throws {Error}
   */
  getForceFunction(modelConfig, functions) {
    let forceFunction = modelConfig.forceFunction || this.forceFunction

    // handle @first convention
    {
      // @todo document this behaviour

      if (forceFunction === '@first') {
        forceFunction = functions.filter(
          // @todo use utility function to detect private function names
          ({ name }) => !/_/i.test(name)
        )[0]?.name

        return forceFunction
      }
    }

    // @note validate that forceFunction exists in the functions list - this
    // provides better information to the caller what went wrong and how to
    // address it

    if (forceFunction) {
      // @note if functions array is empty, return undefined to allow graceful
      // handling instead of throwing an error

      if (functions.length === 0) {
        return undefined
      }

      const functionExists = functions.some(
        ({ name }) => name === forceFunction
      )

      if (!functionExists) {
        // @note return undefined instead of throwing to allow graceful fallback
        // when forceFunction doesn't exist (e.g., function was removed from bot
        // configuration, but old conversation state still references it)

        debug(`Force function not found`, { forceFunction })

        return undefined
      }
    }

    return forceFunction
  }

  /**
   * Returns the list of functions that should be called at a specific phase.
   *
   * @param {EngineFunctionCallPhase} phase
   * @param {EngineFunction[]} functions
   * @returns {string[]}
   */
  getFunctionsForPhase(phase, functions) {
    return functions
      .filter(({ call }) => call?.[phase] === true)
      .map(({ name }) => name)
  }

  /**
   * Returns a function that can be used to complete a conversation based on
   * the model.
   *
   * @param {string} model
   * @returns {(input: import('@/lib/conv').ConversationInput) => import('@/lib/conv').ConversationOutput}
   * @throws
   */
  getConvFunction(model) {
    switch (true) {
      case isOpenAIModel(model) && modelSupportsRealtime(model): {
        debug('using realtime conversation for openai')

        return completeRealtimeConversationForOpenAI
      }

      case isOpenAIModel(model) && modelSupportsResponses(model): {
        debug('using responses conversation for openai')

        return completeResponseConversationForOpenAI
      }

      case isOpenAIModel(model) && modelSupportsChat(model): {
        debug('using chat conversation for openai')

        return completeChatConversationForOpenAI
      }

      case isOpenAIModel(model) && true: {
        debug('using text conversation for openai')

        return completeTextConversationForOpenAI
      }

      case isMistralModel(model) && modelSupportsChat(model): {
        debug('using chat conversation for mistral')

        return completeChatConversationForMistral
      }

      case isMistralModel(model) && true: {
        throw new Error(`Unsupported model: ${model}`)
      }

      case isZaiModel(model) && modelSupportsChat(model): {
        debug('using chat conversation for zai')

        return completeChatConversationForZai
      }

      case isZaiModel(model) && true: {
        throw new Error(`Unsupported model: ${model}`)
      }

      case isMoonshotModel(model) && modelSupportsChat(model): {
        debug('using chat conversation for moonshot')

        return completeChatConversationForMoonshot
      }

      case isMoonshotModel(model) && true: {
        throw new Error(`Unsupported model: ${model}`)
      }

      case isQwenModel(model) && modelSupportsChat(model): {
        debug('using chat conversation for qwen')

        return completeChatConversationForQwen
      }

      case isQwenModel(model) && true: {
        throw new Error(`Unsupported model: ${model}`)
      }

      case isGroqModel(model) && modelSupportsChat(model): {
        debug('using chat conversation for groq')

        return completeChatConversationForGroq
      }

      case isGroqModel(model) && true: {
        throw new Error(`Unsupported model: ${model}`)
      }

      case isDeepseekModel(model) && modelSupportsChat(model): {
        debug('using chat conversation for deepseek')

        return completeChatConversationForDeepseek
      }

      case isDeepseekModel(model) && true: {
        throw new Error(`Unsupported model: ${model}`)
      }

      case isOpenrouterModel(model) && modelSupportsChat(model): {
        debug('using chat conversation for openrouter')

        return completeChatConversationForOpenrouter
      }

      case isOpenrouterModel(model) && true: {
        throw new Error(`Unsupported model: ${model}`)
      }

      case isPerplexityModel(model) && modelSupportsChat(model): {
        debug('using chat conversation for perplexity')

        return completeChatConversationForPerplexity
      }

      case isPerplexityModel(model) && true: {
        throw new Error(`Unsupported model: ${model}`)
      }

      case isVertexModel(model) && modelSupportsChat(model): {
        debug('using chat conversation for vertex')

        return completeChatConversationForVertex
      }

      case isVertexModel(model) && true: {
        throw new Error(`Unsupported model: ${model}`)
      }

      case isBedrockModel(model) && modelSupportsChat(model): {
        debug('using chat conversation for bedrock')

        return completeChatConversationForBedrock
      }

      case isBedrockModel(model) && true: {
        throw new Error(`Unsupported model: ${model}`)
      }

      case isVercelModel(model) && modelSupportsChat(model): {
        debug('using chat conversation for vercel')

        return completeChatConversationForVercel
      }

      case isVercelModel(model) && true: {
        throw new Error(`Unsupported model: ${model}`)
      }

      case isCloudflareModel(model) && modelSupportsChat(model): {
        debug('using chat conversation for cloudflare')

        return completeChatConversationForCloudflare
      }

      case isCloudflareModel(model) && true: {
        throw new Error(`Unsupported model: ${model}`)
      }

      default: {
        throw new Error(`Unsupported model: ${model}`)
      }
    }
  }

  /**
   * @param {AbortSignal | undefined} signal
   * @returns {AbortSignal | undefined}
   */
  getAbortSignal(signal) {
    if (this.signal && signal) {
      return anySignal([this.signal, signal])
    }

    return signal || this.signal
  }

  /**
   * Attaches listeners to the timeout-mark signals (see the `timeoutMarks`
   * feature). Each signal fires once when its mark is crossed, carrying a
   * {@link import('@/lib/timeout.monitor').QueueTimeoutMark} as its `reason`. We surface an
   * ephemeral checkpoint for each. Cleanup is registered for {@link dispose}.
   *
   * @param {AbortSignal[]} markSignals
   * @returns {void}
   */
  #registerTimeoutMarks(markSignals) {
    for (const markSignal of markSignals) {
      const onMark = () => {
        void this.#recordTimeoutMark(markSignal.reason)
      }

      if (markSignal.aborted) {
        onMark()

        continue
      }

      markSignal.addEventListener('abort', onMark, { once: true })

      this.#markSignalCleanups.push(() => {
        markSignal.removeEventListener('abort', onMark)
      })
    }
  }

  /**
   * Surfaces a time-budget checkpoint to the model when a timeout mark is
   * crossed. The checkpoint is an EPHEMERAL local message ({@link liveMessages}),
   * injected into the prompt on every subsequent round of the in-flight
   * completion but never written to the conversation log - it is operational
   * nudging, not conversation content. Best-effort: a failure here must never
   * affect the in-flight turn.
   *
   * @param {unknown} reason - the fired signal's reason (a QueueTimeoutMark)
   * @returns {Promise<void>}
   */
  async #recordTimeoutMark(reason) {
    try {
      const { mark, elapsedMs, final } =
        /** @type {{ mark?: number, elapsedMs?: number, final?: boolean }} */ (
          reason || {}
        )

      this.liveMessages.push(
        ...makeActivityMessagePair(
          '_timeBudgetCheckpoint',
          { mark },
          {
            elapsedMs,
            // @note the monitor flags the last mark as `final`; only then do we
            // surface a wrap-up warning to the model. We trust the producer's
            // flag rather than re-deriving lastness from the marks array.

            ...(final && {
              final: true,

              warning:
                'This conversation is dangerously approaching its maximum duration and will be forcibly terminated shortly. Wrap up and deliver your final response now.',
            }),
          }
        )
      )
    } catch (error) {
      await captureException(error)
    }
  }

  /**
   * Gets the id of a file based on the identifier.
   *
   * @param {string} identifier
   * @returns {Promise<Pick<import('@/prisma/types').File,'id'|'name'|'description'>|null>}
   */
  async getFileInfo(identifier) {
    // @todo do not cache if invoked from console - in console we want to get
    // the fresh result

    return await swrCache(
      `conversation.engine.getFileInfo:${identifier}:${this.userId}`,
      FIVE_MINUTE_IN_SECONDS,
      async () => {
        const file = await prisma.file.findUniqueByIdentifier(
          { id: this.userId },
          identifier
        )

        if (!file) {
          return null
        }

        return {
          id: file.id,

          name: file.name,
          description: file.description,
        }
      }
    )
  }

  /**
   * Gets the contents of a file based on the identifier.
   *
   * @param {string} identifier
   * @returns {Promise<string|null>}
   */
  async getFileContents(identifier) {
    // @todo do not cache if invoked from console - in console we want to get
    // the fresh result

    return await swrCache(
      `conversation.engine.getFileContents:${identifier}:${this.userId}`,
      FIVE_MINUTE_IN_SECONDS,
      async () => {
        const file = await prisma.file.findUniqueByIdentifier(
          { id: this.userId },
          identifier
        )

        if (!file) {
          return null
        }

        const url = await getFileObjectDownloadUrl(file.id)

        const chunks = await chunkUrl(new URL(url), {
          userId: this.userId,
          size: Number.MAX_SAFE_INTEGER,
          overlap: 0,
        })

        const text = chunks.items.map(({ text }) => text).join('\n\n')

        return text
      }
    )
  }

  /**
   * Gets the info of a bot based on the identifier.
   *
   * @param {string} identifier
   * @returns {Promise<Pick<import('@/prisma/types').Bot,'id'|'name'|'description'|'backstory'|'model'>|null>}
   */
  async getBotInfo(identifier) {
    // @todo do not cache if invoked from console - in console we want to get
    // the fresh result

    return await swrCache(
      `conversation.engine.getBotInfo:${identifier}:${this.userId}`,
      FIVE_MINUTE_IN_SECONDS,
      async () => {
        const bot = await prisma.bot.findUniqueByIdentifier(
          { id: this.userId },
          identifier
        )

        if (!bot) {
          return null
        }

        const { name: model } = parseLanguageModel(
          bot.model || defaultLanguageModel
        )

        return {
          id: bot.id,

          name: bot.name,
          description: bot.description,

          backstory: bot.backstory,

          model: model,
        }
      }
    )
  }

  /**
   * Gets the info of a dataset based on the identifier.
   *
   * @param {string} identifier
   * @returns {Promise<Pick<Dataset,'id'|'name'|'description'>|null>}
   */
  async getDatasetInfo(identifier) {
    // @todo do not cache if invoked from console - in console we want to get
    // the fresh result

    return await swrCache(
      `conversation.engine.getDatasetInfo:${identifier}:${this.userId}`,
      FIVE_MINUTE_IN_SECONDS,
      async () => {
        const dataset = await prisma.dataset.findUniqueByIdentifier(
          { id: this.userId },
          identifier
        )

        if (!dataset) {
          return null
        }

        return {
          id: dataset.id,

          name: dataset.name,
          description: dataset.description,
        }
      }
    )
  }

  /**
   * Gets the info of a skillset based on the identifier.
   *
   * @param {string} identifier
   * @returns {Promise<Pick<Skillset,'id'|'name'|'description'>|null>}
   */
  async getSkillsetInfo(identifier) {
    // @todo do not cache if invoked from console - in console we want to get
    // the fresh result

    return await swrCache(
      `conversation.engine.getSkillsetInfo:${identifier}:${this.userId}`,
      FIVE_MINUTE_IN_SECONDS,
      async () => {
        const skillset = await prisma.skillset.findUniqueByIdentifier(
          { id: this.userId },
          identifier
        )

        if (!skillset) {
          return null
        }

        return {
          id: skillset.id,
          name: skillset.name,
          description: skillset.description,
        }
      }
    )
  }

  /**
   * Gets a list of messages to process. The function will filter out empty,
   * backstory and other messages based on the message type. It will also make
   * sure the list is capped at a certain number of messages. The final list
   * will always include the backstory message if it exists.
   *
   * @param {number} [maxMessages]
   * @returns {Promise<Message[]>}
   */
  async getMessages(maxMessages) {
    // make sure we have at least 2 messages

    maxMessages = Math.max(maxMessages || 100, 2)

    // clone messages

    let messages = this.messages.slice(0)

    // prepare messages
    {
      // @todo maybe move this logic into the designated conv function which is
      // actually responsible for building the conversation

      debug(`preparing messages`, { messages }).log(
        'conversation.engine.CoreEngine.getMessages'
      )

      messages = messages
        // trim text if user message
        .map((m) => {
          if (m.type === MessageType.user) {
            m = { ...m, text: m.text.trim() }
          }

          return m
        })
        // filter out empty messages as long as they are not activities
        .filter((m) => {
          return !(!m.text && m.type !== MessageType.activity)
        })
        // filter activity messages that don't come in pairs
        .filter((m, i, ms) => {
          if (m.type === MessageType.activity) {
            return (
              (ms[i - 1] && ms[i - 1].type === MessageType.activity) ||
              (ms[i + 1] && ms[i + 1].type === MessageType.activity)
            )
          }

          return true
        })
        // filter duplicate consecutive messages of the same type but not activities
        .filter((m, i, ms) => {
          if (m.type === MessageType.activity) {
            return true
          }

          return (
            i === 0 || m.type !== ms[i - 1].type || m.text !== ms[i - 1].text
          )
        })

      debug(`prepared messages`, { messages }).log(
        'conversation.engine.CoreEngine.getMessages'
      )
    }

    // pop the last message, which has the highest priority

    const lastMessage = messages.pop()

    // extract the backstory before the slice - it must not consume the
    // maxMessages budget and must be re-prepended in its guaranteed position
    const backstoryMessage =
      messages.findLast((m) => m.type === MessageType.backstory) ?? null

    // extract the checkpoint before the slice - it must not consume the
    // maxMessages budget and must be re-inserted in its guaranteed position
    const checkpointMessage =
      messages.findLast((m) => m.type === MessageType.checkpoint) ?? null

    // do further processing without the last message
    {
      messages = messages
        // filter based on message type
        .filter(({ type }) => {
          switch (true) {
            // filter out backstories - the active backstory is re-prepended below
            case type === MessageType.backstory:
              return false

            // filter out checkpoints - re-inserted after backstory below
            case type === MessageType.checkpoint:
              return false

            // all the rest are good

            default:
              return true
          }
        })
        // slice to the maximum number of messages
        .slice(-maxMessages + 1) // +1 because we popped the last item
    }

    // add the backstory
    {
      let backstory = this.backstory || backstoryMessage?.text || ''

      // normalize the backstory
      {
        backstory = backstory.trim()
      }

      // normalize the backstory
      {
        backstory = backstory.trim()
      }

      // add features to the backstory
      {
        if (this.features) {
          let featureBackstoryParts = []

          for (const feature of this.features) {
            const { name } = feature

            switch (name) {
              case 'backstory': {
                const text = feature.options?.text?.trim()

                if (text) {
                  if (feature.options.mode === 'replace') {
                    backstory = text
                  } else {
                    if (backstory) {
                      backstory = backstory.trim() + '\n\n'
                    }

                    backstory += text
                  }
                }

                break
              }

              case 'notes': {
                // @note append each note to the backstory as an emphatic `!NB:`
                // line - the array-friendly shorthand for repeating a
                // `backstory` extend feature once per note. We skip the prefix
                // when the caller already wrote one so we never double it up.
                for (const note of feature.options.notes) {
                  const text = note?.trim()

                  if (text) {
                    if (backstory) {
                      backstory = backstory.trim() + '\n\n'
                    }

                    backstory += /^!?NB:/i.test(text) ? text : `!NB: ${text}`
                  }
                }

                break
              }

              case 'diligence': {
                featureBackstoryParts.push(
                  computePrompt(diligenceGeneratorPrompt, {})
                )

                break
              }

              case 'personalization': {
                const contact = getContextContact()

                if (contact) {
                  featureBackstoryParts.push(
                    computePrompt(personalizationPrompt, {})
                  )

                  messages.unshift(
                    ...makeActivityMessagePair(
                      'getCurrentUserProfile',
                      {},
                      {
                        details: contact,
                      }
                    )
                  )
                }

                break
              }

              case 'userInfo': {
                // @note surface who we are talking to (e.g. the participant who
                // sent the current message) as a soft activity message carrying
                // the info object the feature was configured with. We push it so
                // it lands right before the current message that gets re-appended
                // below. We deliberately do NOT add this to the backstory:
                // user-controlled identity data in the system prompt would be a
                // prompt-injection vector, so it stays in the activity message
                // only. This is ephemeral context for this turn (getMessages is
                // not persisted), letting multi-user channels attribute the turn
                // to a participant without writing per-message authorship.
                {
                  const info = feature.options

                  if (info) {
                    messages.push(
                      ...makeActivityMessagePair(
                        'getUserInfo',
                        {},
                        {
                          details: info,
                        }
                      )
                    )
                  }
                }

                break
              }

              case 'memory': {
                break
              }

              case 'task': {
                break
              }

              case 'time': {
                break
              }

              case 'markdown': {
                featureBackstoryParts.push(
                  computePrompt(markdownGeneratorPrompt, {})
                )

                break
              }

              case 'buttons': {
                featureBackstoryParts.push(
                  computePrompt(buttonsGeneratorPrompt, {})
                )

                break
              }

              case 'math': {
                featureBackstoryParts.push(
                  computePrompt(mathGeneratorPrompt, {})
                )

                break
              }

              case 'references': {
                featureBackstoryParts.push(
                  computePrompt(referencesGeneratorPrompt, {})
                )

                break
              }

              case 'carousel': {
                featureBackstoryParts.push(
                  computePrompt(carouselGeneratorPrompt, {})
                )

                break
              }

              case 'form': {
                featureBackstoryParts.push(
                  computePrompt(formGeneratorPrompt, {})
                )

                break
              }

              case 'mermaid': {
                featureBackstoryParts.push(
                  computePrompt(mermaidGeneratorPrompt, {})
                )

                break
              }

              case 'audio': {
                featureBackstoryParts.push(
                  computePrompt(audioGeneratorPrompt, {})
                )

                break
              }

              case 'canvas': {
                featureBackstoryParts.push(
                  computePrompt(canvasGeneratorPrompt, {})
                )

                break
              }

              case 'footnotes': {
                featureBackstoryParts.push(
                  computePrompt(footnotesGeneratorPrompt, {})
                )

                break
              }

              case 'batch': {
                featureBackstoryParts.push(computePrompt(batchPrompt, {}))

                break
              }

              case 'silent': {
                featureBackstoryParts.push(computePrompt(silentPrompt, {}))

                break
              }

              case 'answer': {
                featureBackstoryParts.push(computePrompt(answerPrompt, {}))

                break
              }

              case 'vision': {
                break
              }

              case 'attachments': {
                break
              }

              case 'dataset': {
                break
              }

              case 'skillset': {
                break
              }

              case 'auth': {
                featureBackstoryParts.push(
                  computePrompt(authGeneratorPrompt, {})
                )

                break
              }

              case 'web': {
                break
              }

              case 'bash': {
                break
              }

              case 'chunking': {
                break
              }

              case 'noFeatures': {
                break
              }

              case 'noFunctions': {
                break
              }

              case 'noInlineDatasets': {
                break
              }

              case 'noInlineSkillsets': {
                break
              }

              case 'bpacc': {
                break
              }

              case 'skills': {
                break
              }

              case 'reprogramming': {
                break
              }

              case 'justification': {
                break
              }

              case 'compact': {
                break
              }

              case 'timeoutMarks': {
                featureBackstoryParts.push(
                  computePrompt(timeoutMarksPrompt, {})
                )

                break
              }

              default: {
                assertUnreachable(name)
              }
            }
          }

          debug(`feature parts`, { featureBackstoryParts }).log(
            'conversation.engine.CoreEngine.getMessages'
          )

          featureBackstoryParts = Array.from(new Set(featureBackstoryParts))

          if (featureBackstoryParts.length) {
            if (!backstory) {
              backstory = ''
            }

            backstory += '\n\n' + featureBackstoryParts.join('\n\n')
          }
        }
      }

      // add dataset name and description to the backstory
      {
        // @todo maybe use feature to enable this
        {
          const dataset = await this.getDataset()

          if (dataset && dataset.name && dataset.description) {
            if (backstory) {
              backstory = backstory.trim() + '\n\n'
            }

            // @note we use getCombinedDescription to include the full description
            // with --- separator lines removed for consistent display

            backstory += `# Dataset

You have access to a dataset which you can use to answer specific questions. Use the \`${DATASET_QUERY_FUNCTION_NAME}\` function to query the dataset. 

## Name

${dataset.name}

## Description

${getCombinedDescription(dataset.description)}`
          }
        }
      }

      // add skillset name and description to the backstory
      {
        // @todo maybe use feature to enable this
        {
          const skillset = await this.getSkillset()

          if (skillset && skillset.name && skillset.description) {
            if (backstory) {
              backstory = backstory.trim() + '\n\n'
            }

            // @note we use getCombinedDescription to include the full description
            // with --- separator lines removed for consistent display

            backstory += `# Skillset

You have access to a skillset which you can use to perform tasks. The skillset contains additional tools available to you.

## Name

${skillset.name}

## Description

${getCombinedDescription(skillset.description)}`
          }
        }
      }

      // add inline datasets to the backstory
      {
        if (this.inlineDatasets && this.inlineDatasets.length > 0) {
          for (const inlineDataset of this.inlineDatasets) {
            if (inlineDataset.records?.length) {
              if (backstory) {
                backstory = backstory.trim() + '\n\n'
              }

              // @note we use getCombinedDescription to include the full description
              // with --- separator lines removed for consistent display
              backstory += `# Inline Dataset

You have access to a number of records that you can use to answer specific questions.

## Name

${inlineDataset.name || 'N/A'}

## Description

${getCombinedDescription(inlineDataset.description || '')}

## Records

${stringifyYAML(inlineDataset.records.map(({ text }) => text))}
`
            }
          }
        }
      }

      // add inline skillsets to the backstory
      {
        if (this.inlineSkillsets && this.inlineSkillsets.length > 0) {
          for (const inlineSkillset of this.inlineSkillsets) {
            if (
              inlineSkillset.abilities?.length &&
              inlineSkillset.name &&
              inlineSkillset.description
            ) {
              if (backstory) {
                backstory = backstory.trim() + '\n\n'
              }

              // @note we use getCombinedDescription to include the full description
              // with --- separator lines removed for consistent display
              backstory += `# Inline Skillset

You have access to a skillset which you can use to perform tasks. The skillset contains additional tools available to you.

## Name

${inlineSkillset.name}

## Description

${getCombinedDescription(inlineSkillset.description)}`
            }
          }
        }
      }

      // normalize the backstory
      {
        backstory = backstory.trim()
      }

      // add backstory extra
      {
        if (this.backstoryExtra) {
          if (backstory) {
            backstory += '\n\n'
          }

          backstory += this.backstoryExtra
        }
      }

      // substitute the backstory placeholders
      {
        if (backstory) {
          // handle file substitutions
          {
            backstory = await replaceAllAsync(
              backstory,
              /\$\{FILE_(?<identifier>.+?)_ID\}/,
              async (match) => {
                return (
                  (await this.getFileInfo(match.groups.identifier))?.id || ''
                )
              }
            )

            backstory = await replaceAllAsync(
              backstory,
              /\$\{FILE_(?<identifier>.+?)_NAME\}/,
              async (match) => {
                return (
                  (await this.getFileInfo(match.groups.identifier))?.name || ''
                )
              }
            )

            backstory = await replaceAllAsync(
              backstory,
              /\$\{FILE_(?<identifier>.+?)_DESCRIPTION\}/,
              async (match) => {
                return (
                  (await this.getFileInfo(match.groups.identifier))
                    ?.description || ''
                )
              }
            )

            backstory = await replaceAllAsync(
              backstory,
              /\$\{FILE_(?<identifier>.+?)_CONTENTS?\}/,
              async (match) => {
                return (
                  (await this.getFileContents(match.groups.identifier)) || ''
                )
              }
            )

            // @todo should remove, or use the ID instead

            backstory = await replaceAllAsync(
              backstory,
              /\$\{FILE_(?<identifier>.+?)\}/,
              async (match) => {
                return (
                  (await this.getFileContents(match.groups.identifier)) || ''
                )
              }
            )
          }

          // handle bot substitutions
          {
            backstory = await replaceAllAsync(
              backstory,
              /\$\{BOT_(?<identifier>.+?)_ID\}/,
              async (match) => {
                return (
                  (await this.getBotInfo(match.groups.identifier))?.id || ''
                )
              }
            )

            backstory = await replaceAllAsync(
              backstory,
              /\$\{BOT_(?<identifier>.+?)_BACKSTORY\}/,
              async (match) => {
                return (
                  (await this.getBotInfo(match.groups.identifier))?.backstory ||
                  ''
                )
              }
            )

            backstory = await replaceAllAsync(
              backstory,
              /\$\{BOT_(?<identifier>.+?)_MODEL\}/,
              async (match) => {
                return (
                  (await this.getBotInfo(match.groups.identifier))?.model || ''
                )
              }
            )

            // @todo should remove, or use the ID instead

            backstory = await replaceAllAsync(
              backstory,
              /\$\{BOT_(?<identifier>.+?)\}/,
              async (match) => {
                return (
                  (await this.getBotInfo(match.groups.identifier))?.backstory ||
                  ''
                )
              }
            )
          }

          // @note token-caching caveat: EARTH_TIME and ELAPSED_TIME change on
          // every request, so substituting them rewrites part of the backstory
          // each turn. That defeats prompt (token) caching, which relies on a
          // stable prefix to reuse previously processed tokens, and the
          // practical effect is higher cost and latency since the model has to
          // reprocess the changed portion. Backstory authors should use these
          // fields only where the dynamic value genuinely adds value and place
          // them as late in the backstory as possible so the cacheable prefix
          // stays as long as it can.

          backstory = await replaceWithMapAsync(backstory, {
            '${EARTH_DATE}': getShortDate(new Date(), {
              timeZone: getTimezone(getContextTimezone()),
            }),
            '${EARTH_TIME}': getShortTime(new Date(), {
              timeZone: getTimezone(getContextTimezone()),
            }),
            '${ELAPSED_TIME}': timeAgo(
              getContextRequestStartTime() || new Date()
            ),
          })

          backstory = await replaceWithMapAsync(
            backstory,
            Object.fromEntries(
              Object.entries(await this.getSubstitutions()).map(([k, v]) => [
                `\${${k}}`,
                v,
              ])
            )
          )
        }
      }

      // normalize the backstory
      {
        backstory = backstory.trim()
      }

      // add the backstory if available
      {
        if (backstory) {
          debug(`using backstory`, { backstory }).log(
            'conversation.engine.CoreEngine.getMessages'
          )

          if (messages.length >= maxMessages) {
            messages.shift()
          }

          messages.unshift({ type: MessageType.backstory, text: backstory })
        }
      }

      // re-insert the checkpoint right after the backstory (if any) backstory
      // is always at index 0 when present; splice(0+1) or splice(0) when absent
      {
        if (checkpointMessage) {
          const backstoryIndex = messages.findIndex(
            (m) => m.type === MessageType.backstory
          )

          messages.splice(backstoryIndex + 1, 0, checkpointMessage)
        }
      }
    }

    // if there is a last message, add it back to the list
    {
      if (lastMessage) {
        if (lastMessage.type !== MessageType.user) {
          // @todo maybe break here, because the assumption is that if the last
          // message is not a user message then there is nothing really needed to
          // process, including searching datasets or applying skillsets, etc
        }

        messages.push(lastMessage)
      }
    }

    debug(`messages`, { messages }).log(
      'conversation.engine.CoreEngine.getMessages'
    )

    return messages
  }

  /**
   * The function is responsible for handling privacy. It will detect entities
   * in the messages and replace them with safe entities. The function will
   * return true if the process is successful and false if the process is
   * unsuccessful.
   *
   * @param {SafeEntity[]} newEntities
   * @param {Message[]} messages
   * @returns {Promise<boolean>}
   */
  async handlePrivacy(newEntities, messages) {
    if (this.privacy) {
      // @todo gate on an entitlement rather than assuming it is always on

      debug(`detecting entities`)

      for (let i = messages.length - 1; i >= 0; i--) {
        const { type, text } = messages[i]

        if (type !== MessageType.user) {
          break
        }

        // @note we use the fallbackOnFailure function to make sure that the
        // entity detection does not fail the entire process - as it is a small
        // part of the process and should not be a blocker - yet it is important

        const piiEntities = await fallbackOnFailure(detectPiiEntities(text), [])

        debug(`entity detection finished`, { piiEntities })

        const { safeText, safeEntities } = getSafeTextAndEntities(
          text,
          piiEntities,
          this.entities
        )

        debug(`safe text and entities extracted`, { safeText, safeEntities })

        messages[i].text = safeText

        if (safeEntities.length) {
          newEntities.push(...safeEntities)
        }
      }
    } else {
      debug(`skipping entity detection`)
    }

    return true
  }

  /**
   * The function is responsible for handling moderation. It will detect abuse
   * in the messages and add a context message if abuse is detected. The
   * function will return true if the process is successful and false if the
   * process is unsuccessful.
   *
   * @param {Message[]} newMessages
   * @param {Message[]} messages
   * @returns {Promise<boolean>}
   * @todo new messages should be directly added
   */
  async handleModeration(newMessages, messages) {
    if (this.moderation) {
      // @todo gate on an entitlement rather than assuming it is always on

      debug(`detecting abuse`)

      for (let i = messages.length - 1; i >= 0; i--) {
        const { type, text } = messages[i]

        if (type !== MessageType.user) {
          break
        }

        // @note we use the fallbackOnFailure function to make sure that the
        // abuse detection does not fail the entire process - as it is a small
        // part of the process and should not be a blocker - yet it is important

        const { flagged, categories } = await fallbackOnFailure(
          detectContentAbuse(text),
          { flagged: false, categories: [] }
        )

        debug(`abuse detection finished`, { flagged, categories })

        if (flagged) {
          newMessages.push({
            type: MessageType.context,

            // @todo make sure the message is configurable

            text: `Last message was flagged for content abuse: ${categories.join(
              ', '
            )}.`,

            meta: {
              ...this.meta,

              abuse: {
                flagged,
                categories,
              },
            },
          })

          await this.addMessages(newMessages)

          return false
        }
      }
    } else {
      debug(`skipping abuse detection`)
    }

    return true
  }

  /**
   * Get a list of substitutions that can be used in the engine.
   *
   * @returns {Promise<Record<string,string>>}
   */
  async getSubstitutions() {
    debug(`getting substitutions`).log(
      'conversation.engine.CoreEngine.getSubstitutions'
    )

    // @todo generally speaking all of this information should be available as
    // static functions inserted at the beginning of the conversation rather
    // than as substitutions - this will certainly prevent injection attacks

    const object = {}

    // assign context user details
    {
      const user = getContextUser()

      if (user) {
        // @todo add manual section
        const userObject = flatten(
          {
            id: user.id,
            name: user.name || '""',
            email: user.email || '""',
            meta: user.meta,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
          'user_',
          '_'
        )

        Object.assign(object, userObject)
      }
    }

    // assign context namespace details
    {
      const namespace = getContextNamespace()

      if (namespace) {
        // @todo add manual section
        const namespaceObject = flatten(
          {
            id: namespace,
          },
          'namespace_',
          '_'
        )

        Object.assign(object, namespaceObject)
      }
    }

    // assign context contact details
    {
      const contact = getContextContact()

      if (contact) {
        // @todo add manual section
        const contactObject = flatten(
          {
            id: contact.id,
            name: contact.name || '""',
            description: contact.description || '""',
            preferences: contact.preferences || '""',
            email: contact.email || '""',
            phone: contact.phone || '""',
            nick: contact.nick || '""',
            meta: contact.meta,
            createdAt: contact.createdAt,
            updatedAt: contact.updatedAt,
          },
          'contact_',
          '_'
        )

        Object.assign(object, contactObject)
      }
    }

    // assign context conversation details
    {
      const conversation = getContextConversation()

      if (conversation) {
        // @todo add manual section
        const conversationObject = flatten(
          {
            id: conversation.id,
            name: conversation.name || '""',
            description: conversation.description || '""',
            meta: conversation.meta,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            // utility
            callback: hasContextSession()
              ? await sign(
                  getExternalAPIHostURL(
                    `/v1/conversation/${conversation.id}/callback`
                  ),
                  getContextSession()
                )
              : undefined,
          },
          'conversation_',
          '_'
        )

        Object.assign(object, conversationObject)
      }
    }

    // assign context bot details
    {
      const bot = getContextBot()

      if (bot) {
        // @todo add manual section
        const botObject = flatten(
          {
            id: bot.id,
            name: bot.name || '""',
            description: bot.description || '""',
            meta: bot.meta,
            createdAt: bot.createdAt,
            updatedAt: bot.updatedAt,
          },
          'bot_',
          '_'
        )

        Object.assign(object, botObject)
      }
    }

    // assign external id
    {
      const externalObject = flatten(
        {
          id: object.contact_id || object.namespace,
        },
        'external_',
        '_'
      )

      Object.assign(object, externalObject)
    }

    const substitutions = Object.fromEntries(
      Object.entries(object).map(([name, value]) => {
        return [name.toUpperCase(), (value ?? '').toString()]
      })
    )

    debug(`substitutions`, { substitutions }).log(
      'conversation.engine.CoreEngine.getSubstitutions'
    )

    return substitutions
  }

  /**
   * The function is responsible for getting the dataset associated with the
   * engine. The function will return null if there is no dataset associated
   * with the engine. The function will throw an error if the user is not
   * authorized to access the dataset.
   *
   * @returns {Promise<Dataset|null>}
   */
  async getDataset() {
    // @todo take into consideration noInlineDatasets feature
    // @todo take into consideration changes of this.datasetId

    if (!this.datasetId && !this.inlineDatasets?.length) {
      this.datasetPromise = null

      return this.datasetPromise
    }

    if (!this.datasetPromise) {
      if (this.datasetId && this.datasetId !== '-') {
        this.datasetPromise = prisma.dataset.findUnique({
          where: {
            id: this.datasetId,
          },
        })
      } else if (this.inlineDatasets && this.inlineDatasets.length > 0) {
        // @todo create inline dataset from multiple inlineDatasets
        // For now, we'll use the first one or merge them
      }

      // @todo add inline dataset records
    }

    const dataset = await this.datasetPromise

    if (!dataset) {
      return null
    }

    if ((await canUseDataset(this.userId, dataset)) === false) {
      if (this.bpacc) {
        debug(`bypassing access control checks`).log(
          'conversation.engine.CoreEngine.getDataset'
        )
      } else {
        throwNotAuthorized('You are not authorized to access this dataset')
      }
    }

    return dataset
  }

  /**
   * The function is responsible for getting the skillset associated with the
   * engine. The function will return null if there is no skillset associated
   * with the engine. The function will throw an error if the user is not
   * authorized to access the skillset.
   *
   * @returns {Promise<Skillset|null>}
   */
  async getSkillset() {
    // @todo take into consideration noInlineSkillsets feature
    // @todo take into consideration changes of this.skillsetId

    if (!this.skillsetId && !this.inlineSkillsets?.length) {
      this.skillsetPromise = null

      return this.skillsetPromise
    }

    if (!this.skillsetPromise) {
      if (this.skillsetId && this.skillsetId !== '-') {
        this.skillsetPromise = prisma.skillset.findUnique({
          where: {
            id: this.skillsetId,
          },

          include: {
            abilities: {
              take: maxAbilitiesTake,
            },
          },
        })
      } else if (this.inlineSkillsets && this.inlineSkillsets.length > 0) {
        this.skillsetPromise = Promise.resolve({
          id: '-',

          name: '-',
          description: '-',

          abilities: [],

          visibility: SkillsetVisibility.private,

          // @note synthetic inline skillsets are always active - the gate in
          // getFunctions whitelists on `state === enabled`, so stamp it here.
          state: ResourceState.enabled,

          alias: null,
          slug: null,
          icon: null,
          rank: null,

          meta: {},

          createdAt: new Date(),
          updatedAt: new Date(),

          userId: this.userId,

          blueprintId: null,

          lockId: null,
        })
      }

      if (!this.skillsetPromise) {
        return null
      }

      this.skillsetPromise = this.skillsetPromise.then(async (skillset) => {
        if (!skillset) {
          return null
        }

        const inlineAbilities = []

        // Flatten all abilities from all inline skillsets
        if (this.inlineSkillsets && this.inlineSkillsets.length > 0) {
          for (const inlineSkillset of this.inlineSkillsets) {
            if (inlineSkillset.abilities) {
              for (const ability of inlineSkillset.abilities) {
                const { secrets, ...rest } = ability

                inlineAbilities.push({
                  ...rest,

                  // @note default inline abilities to active so they pass the
                  // `state === enabled` whitelist; honor an explicit state if
                  // the inline definition provided one.
                  state: rest.state ?? ResourceState.enabled,

                  id: getTempId(),

                  userId: skillset.userId,

                  blueprintId: skillset.blueprintId,

                  skillsetId: skillset.id,

                  createdAt: new Date(),
                  updatedAt: new Date(),

                  inlineSecrets: secrets,
                })
              }
            }
          }
        }

        skillset.abilities = [...inlineAbilities, ...skillset.abilities]

        return skillset
      })
    }

    const skillset = await this.skillsetPromise

    if (!skillset) {
      return null
    }

    if ((await canUseSkillset(this.userId, skillset)) === false) {
      if (this.bpacc) {
        debug(`bypassing access control checks`).log(
          'conversation.engine.CoreEngine.getSkillset'
        )
      } else {
        throwNotAuthorized('You are not authorized to access this skillset')
      }
    }

    return skillset
  }

  /**
   * Queries the dataset associated with the engine.
   *
   * @param {{
   *   name: string,
   *   input: string,
   *   justification?: string,
   *   incomingMessages?: Message[],
   * }} options
   * @returns {Promise<{result: any, messages: Message[], meta?: Record<string,any>, usage: Usage}>}
   */
  async queryDataset({
    name,
    input,
    justification: _justification,
    incomingMessages,
  }) {
    debug(`query dataset`, { name, input }).log(
      'conversation.engine.CoreEngine.queryDataset'
    )

    const dataset = await this.getDataset()

    if (!dataset) {
      debug(`there is no associated dataset`).log(
        'conversation.engine.CoreEngine.queryDataset'
      )

      return { result: null, messages: [], usage: new Usage() }
    }

    // @todo take into account inline records

    const {
      error,
      result = error ? { error } : undefined,
      messages,
      meta,
      usage,
    } = await applyDataset(
      this.userId,

      dataset,

      input,

      {
        sink: this.sink,

        debug: this.debug,

        messages: incomingMessages?.filter((message, index) => {
          if (index === incomingMessages.length - 1) {
            if (isActivityMessage(message)) {
              // @note we are most certainly having an activity message in
              // progress thus we need to filter it out
              if (
                !isTriggerActivityMessage(message) &&
                !isResponseActivityMessage(message)
              ) {
                return false
              }
            }
          }

          return true
        }),

        usageMeta: {
          ...this.usageMeta,
        },

        substitutions: await this.getSubstitutions(),
      }
    )

    return {
      result,
      messages,
      meta,
      usage: Usage.fromTokenAndModel(usage.token, usage.model),
    }
  }

  /**
   * Executes the skillset associated with the engine.
   *
   * @param {{
   *   name: string,
   *   input: string,
   *   justification?: string,
   *   incomingMessages?: Message[],
   *   templateInstance?: import("@/data/abilities/all").AbilityTemplate
   * }} options
   * @returns {Promise<{result: any, messages: Message[], meta?: Record<string,any>, usage: Usage}>}
   */
  async executeSkillset({ name, input, justification, incomingMessages }) {
    debug(`execute skillset`, { name, input }).log(
      'conversation.engine.CoreEngine.executeSkillset'
    )

    const skillset = await this.getSkillset()

    if (!skillset) {
      debug(`there is no associated skillset`).log(
        'conversation.engine.CoreEngine.executeSkillset'
      )

      return { result: null, messages: [], usage: new Usage() }
    }

    const {
      error,
      result = error ? { error } : undefined,
      messages,
      meta,
      usage,
    } = await applySkillset(
      this.userId,

      skillset,

      name,
      input,

      {
        sink: this.sink,

        debug: this.debug,

        justification: justification,

        chunking: !!this.getFeature('chunking'),

        messages: incomingMessages?.filter((message, index) => {
          if (index === incomingMessages.length - 1) {
            if (isActivityMessage(message)) {
              // @note we are most certainly having an activity message in
              // progress thus we need to filter it out
              if (
                !isTriggerActivityMessage(message) &&
                !isResponseActivityMessage(message)
              ) {
                return false
              }
            }
          }

          return true
        }),

        usageMeta: {
          ...this.usageMeta,
        },

        substitutions: await this.getSubstitutions(),
      }
    )

    return {
      result,
      messages,
      meta,
      usage: Usage.fromTokenAndModel(usage.token, usage.model),
    }
  }

  /**
   * This function is responsible for getting the functions that can be used
   * by the underlying model. The functions are the combination of dataset,
   * skillset and custom functions. The dataset and skillset functions are
   * automatically generated based on the dataset and skillset configuration.
   *
   * @param {{
   *   newFunctionMessages: StampedMessage[],
   *   incomingMessages: Message[],
   *   usage: Usage,
   *   newMeta: Record<string,any>,
   *   signal?: AbortSignal,
   * }} options
   * @returns {Promise<EngineFunction[]>}
   * @todo new messages should be directly added
   */
  async getFunctions({
    newFunctionMessages,
    incomingMessages,
    usage,
    newMeta,
    signal,
  }) {
    debug(`getting functions`, {
      newFunctionMessages,
      incomingMessages,
      usage,
      newMeta,
    }).log('conversation.engine.CoreEngine.getFunctions')

    // @todo based on model capabilities we might want to return either a list
    // of specific model functions or no functions at all - this comment arises
    // from the fact that the perplexity sonar models are effectively wrappers
    // around their search - which makes them different from the rest of the
    // models

    // setup dataset functions

    const includeJustification = !!this.getFeature('justification')

    /** @type {EngineFunction[]} */
    let datasetFunctions = []

    {
      const dataset = await this.getDataset()

      if (dataset) {
        const abilities = [
          {
            id: '',

            name: DATASET_QUERY_FUNCTION_NAME,

            description: `Retrieves additional information related to ${JSON.stringify(
              joinTrimmedNotEmpty([dataset.name, dataset.description], ' - ') ||
                'anything'
            )} using an input phrase or a question.`,

            // @note the `query` field is what gives the model a parameter to
            // carry the search phrase. Under the flat-input contract (see
            // ability.function.ts) a fieldless instruction exposes NO parameters,
            // so the model calls the function with `{}` and the search runs empty
            // - which is below applyDataset's minimum length and returns null.
            //  tests in conversation.engine.utest.js
            // ("CoreEngine dataset query function input").
            instruction:
              '```search\n$[query!|a phrase or a question used to look up relevant information in the knowledge base]\n```',

            meta: {},
          },

          // you can add additional abilities here
        ]

        for (const ability of abilities) {
          if (
            this.blockedAbilities.includes(ability.id) ||
            this.blockedAbilities.includes(ability.name)
          ) {
            continue
          }

          datasetFunctions.push({
            name: await getAbilityFunctionName(ability),
            description: await getAbilityFunctionDescription(ability),
            parameters: await getAbilityFunctionParameters(ability, {
              includeJustification,
            }),

            /**
             * @param {EngineFunctionHandlerArgs} args
             * @param {EngineFunctionHandlerContext} context
             * @returns {Promise<any>}
             */
            handler: async (args, context) => {
              debug(`executing dataset handler`, { ability, args }).log(
                'conversation.engine.CoreEngine.getFunctions.datasetFunctions.handler'
              )

              // @note getAbilityFunctionInput serialises the validated fields to
              // a JSON object string (e.g. `{"query":"..."}`), but applyDataset
              // expects a plain search phrase. Unwrap the single `query` field
              // back into a bare string before handing it to queryDataset.
              const input = unwrapDatasetQuery(
                await getAbilityFunctionInput(ability, args, {
                  includeJustification,
                })
              )

              const justification = getAbilityFunctionJustification(
                ability,
                args
              )

              const {
                result: datasetResult,
                messages: datasetMessages,
                meta: datasetMeta,
                usage: datasetUsage,
              } = await this.queryDataset({
                name: ability.name,
                input,
                justification,
                incomingMessages,
              })

              if (datasetMessages.length) {
                // @note the information in newMessages will be stored in the
                // database so use it wisely

                newFunctionMessages.push(
                  ...datasetMessages.map((message) => {
                    return {
                      ...message,

                      createdAt: message.createdAt || new Date(),
                    }
                  })
                )

                // @note we need to propagate the messages back to the context
                // in order to use them in subsequent function calls if
                // necessary

                context.newMessages.push(...datasetMessages)
              }

              Object.assign(newMeta, datasetMeta || {})

              if (datasetUsage.token) {
                usage.addUsage(datasetUsage)
              }

              // return the resulting text as array only, which will be fed back
              // to the model

              const result = new Result(datasetResult, datasetMeta)

              debug(`final result`, { ability, result }).log(
                'conversation.engine.CoreEngine.getFunctions.datasetFunctions.handler'
              )

              return result
            },

            icon: '@logo/chatbotkit.com',
          })
        }

        debug(`using dataset functions`, { datasetFunctions }).log(
          'conversation.engine.CoreEngine.getFunctions'
        )
      }
    }

    // setup skillset functions

    /** @type {EngineFunction[]} */
    let skillsetFunctions = []

    {
      const skillset = await this.getSkillset()

      // @note explicit whitelist: only an enabled skillset contributes tools.
      // Synthetic inline skillsets are stamped `enabled` in getSkillset so they
      // pass; anything not explicitly enabled (disabled/unset) is excluded.
      if (skillset && skillset.state === ResourceState.enabled) {
        const abilities = [
          ...skillset.abilities,

          // you can add additional abilities here
        ]

        for (const ability of abilities) {
          if (
            // @note explicit whitelist: only an enabled ability is exposed as a
            // tool; a disabled (or unset) one is kept but hidden. Inline
            // abilities are defaulted to `enabled` in getSkillset so they pass.
            ability.state !== ResourceState.enabled ||
            this.blockedAbilities.includes(ability.id) ||
            this.blockedAbilities.includes(ability.name)
          ) {
            continue
          }

          // @note Skip abilities with empty or invalid
          // names that would result in empty function names after normalization.
          // This includes empty strings, whitespace-only, and special-characters-only names.
          const normalizedName = ability.name
            ?.replace(/\W+/g, '_')
            .replace(/[_-]+/g, '_')
            .replace(/^_+/, '')
            .replace(/_+$/, '')
            .trim()

          if (!normalizedName) {
            debug(`skipping ability with invalid name`, { ability }).log(
              'conversation.engine.CoreEngine.getFunctions'
            )

            continue
          }

          let templateInstance

          {
            const type = getInstructionType(ability.instruction)

            if (type === 'template') {
              const { template } = parseTemplateInstruction(ability.instruction)

              templateInstance = unpackTemplateInstruction(template)
            }
          }

          skillsetFunctions.push({
            name: await getAbilityFunctionName(ability),
            description: await getAbilityFunctionDescription(ability),
            parameters: await getAbilityFunctionParameters(ability, {
              includeJustification,
            }),

            /**
             * @param {EngineFunctionHandlerArgs} args
             * @param {EngineFunctionHandlerContext} context
             * @returns {Promise<any>}
             */
            handler: async (args, context) => {
              debug(`executing skillset handler`, { ability, args }).log(
                'conversation.engine.CoreEngine.getFunctions.skillsetFunctions.handler'
              )

              const input = await getAbilityFunctionInput(ability, args, {
                includeJustification,
              })

              const justification = getAbilityFunctionJustification(
                ability,
                args
              )

              const {
                result: skillsetResult,
                messages: skillsetMessages,
                meta: skillsetMeta,
                usage: skillsetUsage,
              } = await this.executeSkillset({
                name: ability.name,
                input,
                justification,
                incomingMessages,
                templateInstance,
              })

              if (skillsetMessages.length) {
                // @note the information in newMessages will be stored in the
                // database so use it wisely

                newFunctionMessages.push(
                  ...skillsetMessages.map((message) => {
                    return {
                      ...message,

                      createdAt: message.createdAt || new Date(),
                    }
                  })
                )

                // @note we need to propagate the messages back to the context
                // in order to use them in subsequent function calls if
                // necessary

                context.newMessages.push(...skillsetMessages)
              }

              Object.assign(newMeta, skillsetMeta || {})

              if (skillsetUsage.token) {
                usage.addUsage(skillsetUsage)
              }

              debug(`skillset function result`, {
                ability,
                skillsetResult,
              }).log(
                'conversation.engine.CoreEngine.getFunctions.skillsetFunctions.handler'
              )

              if (skillsetResult instanceof AbortSignal) {
                return skillsetResult
              }

              // return the resulting text as array only, which will be fed back
              // to the model

              const result = new Result(skillsetResult, skillsetMeta)

              debug(`final result`, { ability, result }).log(
                'conversation.engine.CoreEngine.getFunctions.skillsetFunctions.handler'
              )

              return result
            },

            icon: templateInstance?.icon,
          })
        }

        debug(`using skillset functions`, { skillsetFunctions }).log(
          'conversation.engine.CoreEngine.getFunctions'
        )
      }
    }

    // setup environment functions

    /** @type {EngineFunction[]} */
    let environmentFunctions = []

    {
      const tools = await getEnvironmentTools()

      for (const tool of tools) {
        // @note environment tools carry an opaque schema, so - unlike ability
        // tools - we have to graft the justification parameter on here when the
        // feature is enabled, then strip it back out before invoking the tool.

        const { parameters, extractInput } = buildJustificationFunctionSchema(
          tool.inputSchema,
          {
            includeJustification,
          }
        )

        environmentFunctions.push({
          name: tool.name,
          description: tool.description || '',

          parameters,

          handler: async (...handlerArgs) => {
            const args = handlerArgs[0]

            // @note recover the real tool input, dropping the injected
            // justification so it never leaks into the underlying MCP/ability
            // call. The justification is still read from the raw args below.

            const input = extractInput(args)

            const operationId = getRandomId('op-')
            const actionId = getRandomId('action-')

            await this.sink?.push(TAG_OPERATION_BEGIN, {
              id: operationId,

              action: {
                id: actionId,
                kind: 'function',
                name: tool.name,
                input,
                justification: getOperationActionJustification(args),
              },
            })

            try {
              return await tool.handler(input, ...handlerArgs.slice(1))
            } finally {
              await this.sink?.push(TAG_OPERATION_END, {
                id: operationId,

                action: {
                  id: actionId,
                  kind: 'function',
                  name: tool.name,
                  input,
                },
              })
            }
          },
        })
      }
    }

    // setup custom functions

    /** @type {EngineFunction[]} */
    let customFunctions = []

    {
      if (this.functions) {
        for (const fn of this.functions) {
          const {
            name,
            description,
            parameters: fnParameters,
            result,
            call,
          } = fn

          // @note only graft the justification parameter onto functions the
          // engine drives itself - i.e. those with a server-side `result`
          // handler, where we can strip the justification back out before the
          // input is consumed. Client-side (`call`) functions are executed by
          // the caller, so we leave their schema untouched rather than leak an
          // injected justification we have no handler to remove.

          const { parameters, extractInput } = buildJustificationFunctionSchema(
            fnParameters,
            {
              includeJustification: includeJustification && !!result,
            }
          )

          customFunctions.push({
            name: name,
            description: description,

            parameters,

            call,

            // @note we install a custom handler only if a result object is
            // provided, otherwise we expect for the caller to handle the
            // function calls themselves

            handler: result
              ? async (args) => {
                  // @note recover the real function input, dropping the injected
                  // justification so it never leaks into the channel payload or
                  // downstream call. The justification is still read from the raw
                  // args below.

                  const input = extractInput(args)

                  const operationId = getRandomId('op-')
                  const actionId = getRandomId('action-')

                  await this.sink?.push(TAG_OPERATION_BEGIN, {
                    id: operationId,

                    action: {
                      id: actionId,
                      kind: 'function',
                      name: name,
                      input, // @todo ensure this is secure
                      justification: getOperationActionJustification(args),
                    },
                  })

                  try {
                    if (result.data) {
                      return result.data
                    }

                    if (result.channel) {
                      const channel = result.channel

                      const abortController = new AbortController()

                      let interval
                      let timeout

                      if (!this.sessionId) {
                        throw new Error(
                          `Cannot use channel within this context`
                        )
                      }

                      // @note combine engine-level signal with the local
                      // abort controller so that engine shutdown also
                      // cancels the channel wait

                      let message

                      try {
                        message = await waitForChannelMessage(
                          { id: this.sessionId },
                          channel,
                          {
                            abortSignal: anySignal(
                              [
                                abortController.signal,
                                this.getAbortSignal(signal),
                              ].filter(Boolean)
                            ),

                            onSubscribe: async () => {
                              // @todo add type around the payload here

                              const payload = {
                                channel,
                                function: {
                                  name,
                                  args: input,
                                },
                              }

                              debug(`sending wait for channel message begin`, {
                                payload,
                              })

                              await this.sink?.push(
                                TAG_WAIT_FOR_CHANNEL_MESSAGE_BEGIN,
                                payload
                              )

                              interval = setInterval(async () => {
                                await this.sink?.push(TAG_PING, {})
                              }, ONE_MINUTE_IN_MILLISECONDS)

                              timeout = setTimeout(async () => {
                                abortController.abort()
                              }, FIVE_MINUTE_IN_MILLISECONDS)
                            },
                          }
                        )
                      } finally {
                        clearInterval(interval)
                        clearTimeout(timeout)
                      }

                      debug(`received message`, { message })

                      const payload = {
                        channel: result.channel,
                        function: {
                          name,
                          args: input,
                        },
                        message: message,
                      }

                      debug(`sending wait for channel message end`, {
                        payload,
                      })

                      await this.sink?.push(
                        TAG_WAIT_FOR_CHANNEL_MESSAGE_END,
                        payload
                      )

                      debug(`parsed message`, { parsedMessage: message }).log(
                        'conversation.engine.CoreEngine.getFunctions.customFunctions.handler'
                      )

                      if ('abort' in message) {
                        if (message.abort) {
                          const controller = new AbortController()

                          controller.abort()

                          return controller.signal
                        }
                      }

                      if ('error' in message) {
                        if (message.error) {
                          if (typeof message.error === 'string') {
                            return new Error(message.error)
                          } else {
                            return new Error(`Unknown error occurred`)
                          }
                        }
                      }

                      if ('result' in message) {
                        return message.result
                      }

                      return message
                    }

                    throw new Error(`Unsupported result type`)
                  } finally {
                    await this.sink?.push(TAG_OPERATION_END, {
                      id: operationId,

                      action: {
                        id: actionId,
                        kind: 'function',
                        name: name,
                        input, // @todo ensure this is secure
                      },
                    })
                  }
                }
              : undefined,
          })
        }

        // @note we need to prevent dataset and skillset function overlap for
        // security and privacy reasons
        {
          debug(`cleaning custom functions`, { customFunctions })

          customFunctions = customFunctions.filter(
            ({ name }) =>
              !(
                datasetFunctions.some((f) => f.name === name) ||
                skillsetFunctions.some((f) => f.name === name)
              )
          )
        }

        debug(`using custom functions`, { customFunctions })
      }

      if (this.internalFunctions) {
        customFunctions.push(...this.internalFunctions)
      }
    }

    // construct the functions array

    /** @type {EngineFunction[]} */
    const functions = [
      ...datasetFunctions,
      ...skillsetFunctions,
      ...environmentFunctions,
      ...customFunctions,
    ]

    // ensure all functions have unique names
    {
      const functionNames = new Set()

      for (const fn of functions) {
        if (functionNames.has(fn.name)) {
          fn.name = `${fn.name}_${getRandomId()}`
        }

        functionNames.add(fn.name)
      }
    }

    // ensure we can fit the functions up-to some limit
    {
      functions.splice(100) // @todo make this configurable or use the model to determine the limit
    }

    debug(`using functions`, { functions })

    return functions
  }

  /**
   * @override
   */
  async snapshot(options = {}) {
    debug(`snapshot messages`, { messages: this.messages })

    // setup usage

    const usage = new Usage()

    // setup new function messages

    const newFunctionMessages = []

    // setup messages

    const messages = await this.getMessages(MAX_COMPLETE_MESSAGE_TAKE)

    // build functions

    const functions = await this.getFunctions({
      newFunctionMessages,
      incomingMessages: messages,
      usage,
      newMeta: {},
      signal: options.signal,
    })

    return {
      functions: functions.map(
        ({ name, description, parameters, icon, call }) => {
          return {
            name,
            description,
            parameters,
            icon,
            call,
          }
        }
      ),
    }
  }

  /**
   * Adds entities to the engine.
   *
   * @param {SafeEntity[]} entities
   */
  async addEntities(entities) {
    if (entities.length) {
      this.entities.push(...entities)
    }
  }

  /**
   * Adds messages to the engine.
   *
   * @param {Message[]} messages
   * @returns {Promise<(Omit<Message,'id'> & {id: string})[]>}
   */
  async addMessages(messages) {
    if (messages.length) {
      this.messages.push(...messages)
    }

    return messages.map((message) => {
      return {
        id: message.id || getTempId(),

        ...message,
      }
    })
  }

  /**
   * Handles asynchronous conversation items emitted through a conv function
   * sink. This is used by reusable realtime sessions where the provider can
   * emit output after the request that opened the socket has already returned.
   *
   * @param {import('@/lib/conv').Item} item
   * @returns {Promise<void>}
   */
  async handleConversationSinkItem(item) {
    switch (item.type) {
      case TAG_TOKEN:
      case TAG_REASONING_TOKEN:
      case TAG_AUDIO: {
        await this.sink?.push(item.type, item.data)

        break
      }

      case TAG_MESSAGE: {
        const message = /** @type {Message} */ (item.data)
        const [savedMessage] = await this.addMessages([message])

        await this.sink?.push(TAG_MESSAGE, savedMessage)

        break
      }

      case TAG_COMPLETE_BEGIN: {
        await this.sink?.push(TAG_COMPLETE_BEGIN, {
          instance: this.instance,
          iteration: this.iteration,
        })

        break
      }

      case TAG_COMPLETE_END: {
        await this.sink?.push(TAG_COMPLETE_END, {
          instance: this.instance,
          iteration: this.iteration,
          ...item.data,
        })

        break
      }

      case TAG_ABORT: {
        await this.sink?.push(TAG_ABORT, {
          instance: this.instance,
          iteration: this.iteration,
          ...item.data,
        })

        break
      }

      case TAG_USAGE: {
        const usage = new Usage()

        usage.addTokens(item.data.inputTokensUsed, item.data.model, 'input')
        usage.addTokens(item.data.outputTokensUsed, item.data.model, 'output')

        await usage.recordBaseTokens({
          user: { id: this.userId },
          meta: {
            reason: 'conversation/async-sink',

            ...this.usageMeta,
          },
          references: {
            ...this.usageReferences,

            datasetId: this.datasetId,
            skillsetId: this.skillsetId,
          },
        })

        break
      }

      case TAG_ERROR: {
        await this.sink?.push(TAG_ERROR, item.data)

        break
      }

      default: {
        assertUnreachable(item)
      }
    }
  }

  /**
   * @param {import('@/lib/conv').ConversationOutput} it
   * @param {{
   *   usage: Usage,
   *   originalModel: string,
   *   sessionMessages?: Message[],
   *   onBegin?: () => Promise<void>,
   * }} options
   * @returns {Promise<{
   *   messages: StampedMessage[],
   *   reason: CompleteReason,
   *   error?: CompleteError
   * }>}
   * @todo new messages should be directly added
   */
  async stream(it, { usage, originalModel, sessionMessages, onBegin }) {
    /** @type {StampedMessage[]} */
    const newMessages = []

    let partialTokenText = ''
    let partialTokenCreatedAt

    const addPartialTokenMessage = () => {
      if (!partialTokenText) {
        return
      }

      const createdAt = partialTokenCreatedAt || new Date()

      const message = {
        type: MessageType.bot,
        text: partialTokenText,
        createdAt,
      }

      newMessages.push(message)

      if (sessionMessages) {
        sessionMessages.push(message)
      }

      partialTokenText = ''
      partialTokenCreatedAt = undefined
    }

    /** @type {CompleteReason} */
    let completeReason = 'stop' // @note in theory we should be getting the appropriate finish reason from the conv function

    /** @type {CompleteError} */
    let completeError = undefined

    try {
      for await (const item of it) {
        switch (item.type) {
          case TAG_TOKEN: {
            const token = /** @type {Token} */ {
              type: MessageType.bot,
              token: item.data.token,
            }

            await this.sink?.push(TAG_TOKEN, token)

            partialTokenText += item.data.token
            partialTokenCreatedAt = partialTokenCreatedAt || new Date()

            break
          }

          case TAG_REASONING_TOKEN: {
            const reasoningToken = /** @type {ReasoningToken} */ {
              type: MessageType.bot,
              token: item.data.token,
            }

            await this.sink?.push(TAG_REASONING_TOKEN, reasoningToken)

            break
          }

          case TAG_AUDIO: {
            await this.sink?.push(TAG_AUDIO, item.data)

            break
          }

          case TAG_MESSAGE: {
            const message = /** @type {Message} */ (item.data)

            await this.sink?.push(TAG_MESSAGE, message)

            if (message.type === MessageType.bot) {
              partialTokenText = ''
              partialTokenCreatedAt = undefined
            }

            const createdAt = new Date()

            newMessages.push({
              ...message,

              createdAt: message.createdAt || createdAt,
            })

            if (sessionMessages) {
              sessionMessages.push({
                ...message,

                createdAt: message.createdAt || createdAt,
              })
            }

            break
          }

          case TAG_ABORT: {
            await this.sink?.push(TAG_ABORT, {
              instance: this.instance,
              iteration: this.iteration,
              ...item.data,
            })

            completeReason = 'abort'

            addPartialTokenMessage()

            break
          }

          case TAG_COMPLETE_BEGIN: {
            await this.sink?.push(TAG_COMPLETE_BEGIN, {
              instance: this.instance,
              iteration: this.iteration,
            })

            if (onBegin) {
              await onBegin()
            }

            break
          }

          case TAG_COMPLETE_END: {
            await this.sink?.push(TAG_COMPLETE_END, {
              instance: this.instance,
              iteration: this.iteration,
            })

            if (item.data.reason) {
              completeReason = item.data.reason
            }

            break
          }

          case TAG_USAGE: {
            usage.addTokens(
              item.data.inputTokensUsed,

              // @note we always use the original model here because the usage
              // reporting should be done against the model that was given to
              // the caller rather than the one that was used - this is very
              // important in the case of custom models - otherwise the usage
              // reporting will be skewed and incorrect

              originalModel || item.data.model,

              'input'
            )

            usage.addTokens(
              item.data.outputTokensUsed,

              // @note we always use the original model here because the
              // usage reporting should be done against the model that was given
              // to the caller rather than the one that was used - this is very
              // important in the case of custom models - otherwise the usage
              // reporting will be skewed and incorrect

              originalModel || item.data.model,

              'output'
            )

            break
          }

          case TAG_ERROR: {
            await this.sink?.push(TAG_ERROR, item.data)

            break
          }

          default: {
            assertUnreachable(item)
          }
        }
      }
    } catch (e) {
      if (e?.name === ABORT_ERROR_NAME) {
        await this.sink?.push(TAG_ABORT, {
          instance: this.instance,
          iteration: this.iteration,
          reason: e.message,
        })

        completeReason = 'abort'

        addPartialTokenMessage()
      } else {
        await captureException(e)

        // @note normalize the error before emitting it to the sink - pushing
        // the raw error would leak internal details (e.g. the full request body
        // attached to provider errors via SystemError.data) into the stream

        const errorResponse = errorToErrorResponse(e)

        await this?.sink?.push(TAG_ERROR, errorResponse)

        completeReason = 'error'

        // @note carry the normalized error out with the reason. Without it the
        // caller only sees `reason: 'error'` and has to invent a placeholder
        // ("Conversation engine returned error"), which tells whoever reads the
        // failed run nothing about what actually went wrong - the real cause
        // (e.g. a provider 503) was only ever visible in Sentry.

        completeError = errorResponse
      }
    }

    return {
      messages: newMessages,
      reason: completeReason,
      error: completeError,
    }
  }

  /**
   * @override
   * @param {string} text
   * @param {{type?: MessageType, signal?: AbortSignal}} [options]
   * @returns {Promise<SendResponse>}
   */
  async send(text, options) {
    debug(`sending message`, { text, options })

    assert(text, `Empty message`)

    this.iteration = getRandomId('it-')

    const newMessages = [
      {
        type: options?.type || MessageType.user,

        text,
      },
    ]

    await this.addMessages(newMessages)

    const response = await this.process({ signal: options?.signal })

    const messages = response.messages.concat(newMessages)

    return {
      ...response,

      messages,
    }
  }

  /**
   * Returns whether this engine runs in batch mode with settlement enforcement
   * enabled (the `settle` option on the `batch` feature).
   *
   * @returns {boolean}
   */
  isBatchSettle() {
    return this.getFeature('batch')?.options?.settle === true
  }

  /**
   * @override
   * @param {{ signal?: AbortSignal, context?: Record<string, any>, modality?: 'text' | 'audio' }} [options]
   * @returns {Promise<ReceiveResponse>}
   */
  async receive(options) {
    debug(`receiving message`)

    if (options?.context) {
      Object.assign(this.convContext, options.context)
    }

    // @note in batch settle mode the model is driven to settlement (calling
    // `_success` / `_failure`) inside the conv function itself - an unsettled
    // `stop` is nudged and continued there, bounded by the settle budget and,
    // when set, the iteration limit. `receive()` therefore needs no settle loop
    // of its own.

    const response = await this.complete({
      modality: options?.modality,
      signal: options?.signal,
    })

    const lastReceiveMessage = response.messages
      .filter(({ type }) => type === MessageType.bot)
      .pop()

    const text = lastReceiveMessage?.text || ''

    debug(`received message`, { text })

    return {
      ...response,

      text,
    }
  }

  /**
   * @override
   * @param {{
   *   data: string,
   *   format: {
   *     encoding: 'pcm16',
   *     sampleRate: number,
   *     channels: number,
   *   }
   * }} data
   * @param {{ signal?: AbortSignal, context?: Record<string, any>, modality?: 'text' | 'audio' }} [options]
   * @returns {Promise<void>}
   */
  async audio(data, options = {}) {
    debug(`processing audio`)

    if (options.context) {
      Object.assign(this.convContext, options.context)
    }

    if (!modelSupportsRealtime(this.model)) {
      throw new Error(`Audio input requires a realtime model`)
    }

    if (!this.audioCompletion) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this

      this.audioCompletion = new (class {
        #audioStream

        constructor() {
          this.#audioStream = new (class {
            /** @type {((data: import('@/lib/conv').AudioItem) => void)[]} */
            #pushers = []

            /** @type {AbortController[]} */
            #controllers = []

            /** @type {import('@/lib/conv').AudioItem[]} */
            #pendingItems = []

            /** @param {import('@/lib/conv').AudioItem} data */
            push(data) {
              if (!this.#pushers.length) {
                this.#pendingItems.push(data)

                return
              }

              for (const push of this.#pushers) {
                push(data)
              }
            }

            /** @returns {AsyncGenerator<import('@/lib/conv').AudioItem>} */
            async *consume() {
              yield* events(async (push) => {
                this.#pushers.push(push)

                while (this.#pendingItems.length > 0) {
                  const pendingItem = this.#pendingItems.shift()

                  if (pendingItem) {
                    push(pendingItem)
                  }
                }

                const controller = new AbortController()

                this.#controllers.push(controller)

                await wait(controller.signal)
              })
            }

            async cancel() {
              this.#pendingItems = []

              for (const controller of this.#controllers) {
                controller.abort()
              }
            }
          })()
        }

        /** @param {import('@/lib/conv').AudioItem} data */
        push(data) {
          this.#audioStream.push(data)
        }

        async start() {
          const usage = new Usage()

          let addedMessages

          const originalModel = self.model

          try {
            const { config: modelConfig } = self.breakdownLanguageModel()

            const newFunctionMessages = []
            const newMeta = {}
            const messages = await self.getMessages(MAX_COMPLETE_MESSAGE_TAKE)
            const incomingMessages = [...messages]

            const functions = await self.getFunctions({
              newFunctionMessages,
              incomingMessages,
              usage,
              newMeta,
              signal: options.signal,
            })

            /** @type {Message[]} */
            const hintMessages = []

            hintMessages.push(
              ...functions.flatMap(({ hintMessages = [] }) => hintMessages)
            )

            const startFunctions = self.getFunctionsForPhase('start', functions)
            const endFunctions = self.getFunctionsForPhase('end', functions)

            const forceFunction = self.getForceFunction(modelConfig, functions)

            if (forceFunction && !startFunctions.includes(forceFunction)) {
              startFunctions.unshift(forceFunction)
            }

            const allMessages = messages.concat(hintMessages)

            const itFn = self.getConvFunction(self.model)

            const it = itFn({
              clientId: self.getClientId(),

              model: self.model,

              messages: allMessages,

              stream: this.#audioStream.consume(),

              modality: options.modality,

              functions: async () =>
                await self.getFunctions({
                  newFunctionMessages,
                  incomingMessages,
                  usage,
                  newMeta,
                  signal: options.signal,
                }),

              startFunctions: startFunctions,

              endFunctions: endFunctions,

              background: self.isBackground(),

              maxIterations: self.maxIterations,
              maxContinuations: self.maxContinuations,

              callStats: self.callStats,
              maxCalls: self.maxCalls,

              cycleStats: self.cycleStats,
              maxCycles: self.maxCycles,

              abortSignal: self.getAbortSignal(options.signal),

              yieldSignal: self.yieldSignal,

              context: self.convContext,

              // @note ephemeral, in-flight-only messages (e.g. timeout-budget
              // checkpoints): drained here and injected into this round's prompt
              // by optimizeMessages, then carried forward - never persisted, and
              // drained so they are not re-inserted (which would duplicate them)
              liveMessages: () => {
                const pending = self.liveMessages

                self.liveMessages = []

                return pending
              },

              sink: self.convSink,
            })

            const response = await self.stream(it, {
              usage,
              originalModel,
            })

            const newMessages = [...response.messages]

            newMessages.push(
              ...newFunctionMessages.filter(
                ({ type }) => !['context'].includes(type)
              )
            )

            newMessages.forEach((message) => {
              if (message.type === MessageType.bot) {
                message.meta = {
                  ...newMeta,
                  ...message.meta,
                }
              }
            })

            addedMessages = await self.addMessages(newMessages)
          } finally {
            await usage.recordBaseTokens({
              user: { id: self.userId },
              meta: {
                reason: 'conversation/complete',

                ...self.usageMeta,
              },
              references: {
                ...self.usageReferences,

                messageId: addedMessages?.slice(-1)[0]?.id,

                datasetId: self.datasetId,
                skillsetId: self.skillsetId,
              },
            })

            this.#audioStream.cancel()
          }
        }
      })()

      this.audioCompletion?.start().finally(() => {
        delete this.audioCompletion
      })
    }

    /** @type {import('@/lib/conv').AudioItem} */
    const audioItem = {
      type: TAG_AUDIO,
      data,
    }

    this.audioCompletion.push(audioItem)
  }

  /**
   * @override
   * @param {string} text
   * @param {{type?: MessageType, signal?: AbortSignal, context?: Record<string, any>, modality?: 'text' | 'audio'}} [options]
   * @returns {Promise<ReceiveResponse>}
   */
  async steer(text, options) {
    // @todo come up with a very good way to abort such that we also are able
    // to capture the real usage for the task, otherwise we run into real issues
    // where the task might not be correctly accounted for

    if (this.#steerPendingTurn) {
      this.#steerPendingTurn.reject(
        new AbortError(`Conversation steer superseded`)
      )
    }

    const promise = new Promise((resolve, reject) => {
      this.#steerPendingTurn = {
        text,
        options,
        resolve,
        reject,
      }
    })

    this.#steerActiveTurn?.abortController.abort()

    if (!this.#steerDrainPromise) {
      this.#steerDrainPromise = this.#drainSteerTurns().finally(() => {
        this.#steerDrainPromise = null
      })
    }

    return promise
  }

  /**
   * @returns {Promise<void>}
   */
  async #drainSteerTurns() {
    for (;;) {
      if (this.#steerActiveTurn) {
        const activeTurn = this.#steerActiveTurn

        activeTurn.abortController.abort()

        await activeTurn.promise.catch(() => {})

        if (this.#steerActiveTurn === activeTurn) {
          this.#steerActiveTurn = null
        }
      }

      const nextTurn = this.#steerPendingTurn

      this.#steerPendingTurn = null

      if (!nextTurn) {
        return
      }

      const abortController = new AbortController()

      const signal = nextTurn.options?.signal
        ? anySignal([nextTurn.options.signal, abortController.signal])
        : abortController.signal

      const turnPromise = this.#runSteerTurn(nextTurn.text, {
        ...nextTurn.options,
        signal,
      })

      const activeTurn = {
        abortController,
        promise: turnPromise,
      }

      this.#steerActiveTurn = activeTurn

      turnPromise.then(nextTurn.resolve, nextTurn.reject)

      await turnPromise.catch(() => {})

      if (this.#steerActiveTurn === activeTurn) {
        this.#steerActiveTurn = null
      }
    }
  }

  /**
   * @param {string} text
   * @param {{type?: MessageType, signal: AbortSignal, context?: Record<string, any>, modality?: 'text' | 'audio'}} options
   * @returns {Promise<ReceiveResponse>}
   */
  async #runSteerTurn(text, options) {
    await this.send(text, {
      type: options.type,
      signal: options.signal,
    })

    if (options.signal.aborted) {
      throw new AbortError(`Conversation steer aborted`)
    }

    const response = await this.receive({
      modality: options.modality,
      context: options.context,
      signal: options.signal,
    })

    if (options.signal.aborted) {
      throw new AbortError(`Conversation steer aborted`)
    }

    return response
  }

  /**
   * Forces compaction of all messages accumulated since the last checkpoint,
   * regardless of whether the compact feature is enabled or any thresholds are
   * met. Backstory and existing checkpoint messages are excluded from the
   * summary. Returns the checkpoint message (or null if there was nothing to
   * compact or summarization produced no summary) alongside the token usage
   * incurred by the summarization.
   *
   * @param {{ estimatedTokens?: number }} [options]
   * @returns {Promise<{ message: (Message & {id: string})|null, usage: Usage }>}
   */
  async definitelyCompact(options = {}) {
    const { estimatedTokens = 0 } = options

    const lastCheckpointIndex = this.messages.findLastIndex(
      (message) => message.type === MessageType.checkpoint
    )

    const messagesAfterCheckpoint = this.messages.slice(lastCheckpointIndex + 1)

    const messagesToSummarize = messagesAfterCheckpoint.filter(
      (message) =>
        message.type !== MessageType.backstory &&
        message.type !== MessageType.checkpoint
    )

    if (!messagesToSummarize.length) {
      return { message: null, usage: new Usage() }
    }

    const messagesToKeep = this.messages.length - messagesToSummarize.length

    await this.sink?.push(TAG_COMPACTION_BEGIN, {
      messagesToSummarize: messagesToSummarize.length,
      messagesToKeep,
      estimatedTokens,
    })

    /** @type {SavedMessage|null} */
    let checkpointMessage = null

    let usage = new Usage()

    let success = false

    try {
      const { summary, usage: compactUsage } = await compactMessages(
        messagesToSummarize.map(({ type, text }) => ({ type, text })),
        {
          user: { id: this.userId },
          usageReferences: this.usageReferences,
        }
      )

      usage = compactUsage

      if (summary) {
        const [message] = await this.addMessages([
          { type: MessageType.checkpoint, text: summary },
        ])

        checkpointMessage = message || null
      }

      success = Boolean(checkpointMessage)
    } catch (error) {
      captureException(error)
    } finally {
      await this.sink?.push(TAG_COMPACTION_END, { success })
    }

    return { message: checkpointMessage, usage }
  }

  /**
   * Runs compaction if the compact feature is enabled and thresholds are met.
   * Returns the checkpoint message (or null if compaction did not occur)
   * alongside the token usage incurred by the summarization.
   *
   * @param {Usage} usage
   * @returns {Promise<{ message: (Message & {id: string})|null, usage: Usage }>}
   */
  async maybeCompact(usage) {
    const compactFeature = this.getFeature('compact')

    if (!compactFeature) {
      return { message: null, usage: new Usage() }
    }

    const inputTokensUsed = usage.items
      .filter((item) => item.type === 'input')
      .reduce((total, item) => total + item.tokens, 0)

    const lastCheckpointIndex = this.messages.findLastIndex(
      (message) => message.type === MessageType.checkpoint
    )

    const messagesAfterCheckpoint = this.messages.slice(lastCheckpointIndex + 1)

    const messagesToSummarize = messagesAfterCheckpoint.filter(
      (message) =>
        message.type !== MessageType.backstory &&
        message.type !== MessageType.checkpoint
    )

    const compactByTokens =
      typeof compactFeature.options.tokens === 'number' &&
      inputTokensUsed >= compactFeature.options.tokens

    const compactByMessages =
      typeof compactFeature.options.messages === 'number' &&
      messagesToSummarize.length >= compactFeature.options.messages

    const hasMinimumTokensToCompact =
      typeof compactFeature.options.tokens !== 'number' ||
      inputTokensUsed >= MIN_COMPACT_TOKENS_THRESHOLD

    const hasMinimumMessagesToCompact =
      messagesToSummarize.length >= MIN_COMPACT_MESSAGES_THRESHOLD

    if (
      (!compactByTokens && !compactByMessages) ||
      !hasMinimumTokensToCompact ||
      !hasMinimumMessagesToCompact
    ) {
      return { message: null, usage: new Usage() }
    }

    return await this.definitelyCompact({ estimatedTokens: inputTokensUsed })
  }
}

/**
 * This type of engine can be used for all supported models.
 *
 * @deprecated use DynamicFunctionEngine instead
 */
export class BasicFunctionEngine extends CoreEngine {
  /**
   * @typedef {CoreEngineOptions & {
   * }} BasicFunctionEngineOptions
   *
   * @param {BasicFunctionEngineOptions} options
   */
  constructor(options) {
    super(options)
  }

  /**
   * @override
   */
  async process(options = {}) {
    debug(`process messages`, { messages: this.messages })

    // refuse to run a blocked bot (usage policy / manual disable)
    await assertBotNotBlocked()

    options

    // setup usage

    const usage = new Usage()

    let addedMessages

    try {
      // setup new function messages

      const newFunctionMessages = []

      // setup new entities

      const newEntities = []

      // setup new messages

      const newMessages = []

      // setup session messages

      const sessionMessages = []

      // new meta

      const newMeta = {}

      // parse model

      const { config: modelConfig } = this.breakdownLanguageModel()

      // setup messages

      // @note we are using MAX_PROCESS_MESSAGE_TAKE because we are only
      // interested in the last messages for this part of the process, rather
      // than all messages which are controlled my the model - this is a
      // deliberate choice that may require revisiting in the future

      const messages = await this.getMessages(MAX_PROCESS_MESSAGE_TAKE)

      // setup incoming messages

      const incomingMessages = [...messages, ...sessionMessages]

      // handle moderation
      {
        if (!(await this.handleModeration(newMessages, messages))) {
          return {
            usage,

            entities: newEntities,

            messages: newMessages,
          }
        }
      }

      // handle privacy
      {
        if (!(await this.handlePrivacy(newEntities, messages))) {
          return {
            usage,

            entities: newEntities,

            messages: newMessages,
          }
        }
      }

      // handle functions
      {
        const functions = await this.getFunctions({
          newFunctionMessages,
          incomingMessages,
          usage,
          newMeta,
          signal: options.signal,
        })

        let selectedFunction

        if (functions.length) {
          // build hint messages

          /** @type {Message[]} */
          const hintMessages = []

          hintMessages.push(
            ...functions.flatMap(({ hintMessages = [] }) => hintMessages)
          )

          // setup all messages

          const allMessages = messages.concat(hintMessages)

          // intent detection

          debug(`intent detection start`)

          const operationId = getRandomId('op-')
          const actionId = getRandomId('action-')

          await this.sink?.push(TAG_INTENT_DETECTION_BEGIN, {
            id: operationId,

            action: {
              id: actionId,
            },
          })

          // @todo this function needs to be called in a loop until all options
          // are exhausted in order to be effective

          if (modelConfig.forceFunction) {
            selectedFunction = {
              name: modelConfig.forceFunction,
              input: messages.slice(-1)[0]?.text || '',
            }

            debug(`force function detected`, {
              action: selectedFunction,
            })
          } else {
            const {
              action: detectedFunction,

              tokensUsed,
              modelUsed,
            } = await detectIntent(allMessages, functions, {
              user: { id: this.userId },
            })

            selectedFunction = detectedFunction

            usage.addTokens(tokensUsed, modelUsed)

            debug(`intent detection finished`, {
              action: selectedFunction,
              tokensUsed,
              modelUsed,
            })
          }

          if (selectedFunction) {
            await this.sink?.push(TAG_INTENT_DETECTION_END, {
              id: operationId,

              action: {
                id: actionId,
                name: selectedFunction.name,
              },
            })
          }
        }

        // execute function
        {
          let functionInstance

          if (selectedFunction) {
            functionInstance = functions.find(
              ({ name }) => name === selectedFunction.name
            )

            if (!functionInstance) {
              debug(`function not found`, {
                function: selectedFunction,
                functions,
              })
            }
          } else {
            debug(`no function selected`)
          }

          if (selectedFunction && functionInstance) {
            // @todo standardize this function call with the function calls used
            // in the conv functions, alternatively move this logic entirely in
            // the conv functions

            if (functionInstance.handler) {
              debug(`invoking function handler`)

              let result

              try {
                result = await functionInstance.handler(
                  typeof selectedFunction.input === 'object' &&
                    selectedFunction.input !== null
                    ? selectedFunction.input
                    : { input: selectedFunction.input },
                  { newMessages: [] }
                )
              } catch (e) {
                await captureException(e)

                // @note we are deliberately hiding the error from the user
                // because this is an internal issue

                if (e instanceof SafeError) {
                  result = { error: e.message }
                } else {
                  result = { error: 'Function invocation exception' }
                }
              }

              debug(`function handler result`, { result })

              // @note we need to handle the result and there are a few options

              let thisMeta

              if (result instanceof AbortSignal) {
                if (result.aborted) {
                  result = result.reason || null
                }
              } else if (result instanceof Result) {
                thisMeta = result.meta
                result = result.result
              } else if (result instanceof Error) {
                result = { error: result.message }
              }

              newMessages.push({
                type: MessageType.context,
                text:
                  typeof result === 'string' ? result : JSON.stringify(result),
                meta: {
                  ...thisMeta,
                },
              })
            } else {
              // @todo it is a client-side function thus need to be reported
            }
          } else {
            debug(`no function executed`)
          }
        }
      }

      // add function messages

      newMessages.push(...newFunctionMessages)

      // update new message with new meta

      newMessages.forEach((message) => {
        if (message.type === MessageType.bot) {
          message.meta = {
            ...newMeta,

            ...message.meta,
          }
        }
      })

      // add new entities

      await this.addEntities(newEntities)

      // add new messages

      addedMessages = await this.addMessages(newMessages)

      // finish and return

      return {
        usage,

        entities: newEntities,

        messages: newMessages,
      }
    } finally {
      await usage.recordBaseTokens({
        user: { id: this.userId },
        meta: {
          reason: 'conversation/process',

          ...this.usageMeta,
        },
        references: {
          ...this.usageReferences,

          messageId: addedMessages?.slice(-1)[0]?.id,

          datasetId: this.datasetId,
          skillsetId: this.skillsetId,
        },
      })
    }
  }

  /**
   * @override
   */
  async complete(options = {}) {
    debug(`complete messages`, { messages: this.messages })

    // refuse to run a blocked bot (usage policy / manual disable)
    await assertBotNotBlocked()

    // setup usage

    const usage = new Usage()

    let addedMessages

    try {
      // setup new function messages

      const newFunctionMessages = []

      // setup new messages

      const newMessages = []

      // setup session messages

      const sessionMessages = []

      // new meta

      const newMeta = {}

      // parse model

      const { config: modelConfig } = this.breakdownLanguageModel()

      // @note we use the full model string (this.model) because the usage
      // reporting functions need to parse a complete model string

      const originalModel = this.model

      // setup messages

      const messages = await this.getMessages(MAX_COMPLETE_MESSAGE_TAKE)

      // setup incoming messages

      const incomingMessages = [...messages, ...sessionMessages]

      // build functions

      const functions = await this.getFunctions({
        newFunctionMessages,
        incomingMessages,
        usage,
        newMeta,
        signal: options.signal,
      })

      // build hint messages

      /** @type {Message[]} */
      const hintMessages = []

      hintMessages.push(
        ...functions.flatMap(({ hintMessages = [] }) => hintMessages)
      )

      // @note BasicFunctionEngine uses intent detection, not function calling
      // so start/end functions via call property are not supported here

      const forceFunction = this.getForceFunction(modelConfig, functions)

      /** @type {Message[]} */
      const activityMessages = []

      // @note forceFunction is guaranteed to exist in functions if returned
      if (forceFunction) {
        activityMessages.push(makeTriggerActivityMessage(forceFunction))
      }

      // setup all messages

      const allMessages = messages.concat(hintMessages, activityMessages)

      // create conversation

      const itFn = this.getConvFunction(this.model)

      const it = itFn({
        // @note the model contains maxTokens and maxMessages information which
        // is used to control the generation process

        clientId: this.getClientId(),

        model: this.model,

        messages: allMessages,

        modality: options.modality,

        // @note: we do not send functions to the model because they are not needed by definition
        // functions: async () => this.getFunctions({
        //   newFunctionMessages,
        //   incomingMessages,
        //   usage,
        //   newMeta,
        // }),

        background: this.isBackground(),

        // @note enabling settle = handing the conv function a settle budget; a
        // positive `maxSettles` turns on settlement (see the `batch.settle`
        // feature), undefined leaves it off
        maxSettles: this.isBatchSettle() ? DEFAULT_MAX_SETTLES : undefined,

        maxIterations: this.maxIterations,
        maxContinuations: this.maxContinuations,

        callStats: this.callStats,
        maxCalls: this.maxCalls,

        cycleStats: this.cycleStats,
        maxCycles: this.maxCycles,

        abortSignal: this.getAbortSignal(options.signal),

        yieldSignal: this.yieldSignal,

        context: this.convContext,

        // @note ephemeral, in-flight-only messages (e.g. timeout-budget
        // checkpoints): drained here and injected into this round's prompt by
        // optimizeMessages, then carried forward across rounds - never persisted,
        // and drained so they are not re-inserted (which would duplicate them)
        liveMessages: () => this.drainLiveMessages(),

        sink: this.convSink,
      })

      // stream messages

      const {
        messages: newStreamMessage,
        reason: completeReason,
        error: completeError,
      } = await this.stream(it, {
        usage,

        originalModel,

        sessionMessages,

        // @note this is kind of like a hack but it allows us to refresh the
        // functions before we begin an iteration - this is useful in case of
        // dynamic functions that are loaded by the environment and other such
        // scenarios

        onBegin: async () => {
          functions.length = 0

          functions.push(
            ...(await this.getFunctions({
              newFunctionMessages,
              incomingMessages,
              usage,
              newMeta,
              signal: options.signal,
            }))
          )
        },
      })

      // add stream messages

      newMessages.push(...newStreamMessage)

      // add function messages

      newMessages.unshift(...newFunctionMessages)

      // update new message with new meta

      newMessages.forEach((message) => {
        if (message.type === MessageType.bot) {
          message.meta = {
            ...newMeta,

            ...message.meta,
          }
        }
      })

      // sort messages

      sortMessages(newMessages, 'asc')

      // add new messages

      addedMessages = await this.addMessages(newMessages)

      // run compaction if enabled

      const { message: checkpointMessage } = await this.maybeCompact(usage)

      // finish and return

      return {
        usage,

        messages: checkpointMessage
          ? [...newMessages, checkpointMessage]
          : newMessages,

        reason: completeReason,

        error: completeError,
      }
    } finally {
      await usage.recordBaseTokens({
        user: { id: this.userId },
        meta: {
          reason: this.usageReason || 'conversation/complete',

          ...this.usageMeta,
        },
        references: {
          ...this.usageReferences,

          messageId: addedMessages?.slice(-1)[0]?.id,

          datasetId: this.datasetId,
          skillsetId: this.skillsetId,
        },
      })
    }
  }

  /**
   * @override
   */
  async apply(options) {
    debug(`apply messages`, { messages: this.messages, options })

    // setup usage

    const usage = new Usage()

    let addedMessages

    try {
      // setup new function messages

      const newFunctionMessages = []

      // setup new messages

      const newMessages = []

      // setup session messages

      const sessionMessages = []

      // new meta

      const newMeta = {}

      // setup messages

      const messages = await this.getMessages(MAX_COMPLETE_MESSAGE_TAKE)

      // setup incoming messages

      const incomingMessages = [...messages, ...sessionMessages]

      // build functions

      const functions = await this.getFunctions({
        newFunctionMessages,
        incomingMessages,
        usage,
        newMeta,
        signal: options.signal,
      })

      const fn = functions.find(({ name }) => name === options.name)

      if (!fn) {
        throwNotFound(`Function not found`)
      }

      if (!fn.handler) {
        throwBadRequest(`Function cannot be applied server-side`)
      }

      let result = await fn.handler(options.input, {
        newMessages: [],
      })

      let meta

      if (result instanceof AbortSignal) {
        if (result.aborted) {
          result = result.reason || null
        }
      } else if (result instanceof Result) {
        meta = result.meta
        result = result.result
      } else if (result instanceof Error) {
        result = { error: result.message }
      }

      // add function messages

      newMessages.unshift(...newFunctionMessages)

      // update new message with new meta

      newMessages.forEach((message) => {
        if (message.type === MessageType.bot) {
          message.meta = {
            ...newMeta,

            ...message.meta,
          }
        }
      })

      // sort messages

      sortMessages(newMessages, 'asc')

      // add new messages

      addedMessages = await this.addMessages(newMessages)

      // run compaction if enabled

      const { message: checkpointMessage } = await this.maybeCompact(usage)

      // finish and return

      return {
        usage,

        messages: checkpointMessage
          ? [...newMessages, checkpointMessage]
          : newMessages,

        result,

        meta: {
          ...newMeta,
          ...meta,
        },
      }
    } finally {
      await usage.recordBaseTokens({
        user: { id: this.userId },
        meta: {
          reason: 'conversation/apply',

          ...this.usageMeta,
        },
        references: {
          ...this.usageReferences,

          messageId: addedMessages?.slice(-1)[0]?.id,

          datasetId: this.datasetId,
          skillsetId: this.skillsetId,
        },
      })
    }
  }
}

/**
 * This type of engine can be used only with models that support function
 * calling.
 */
export class DynamicFunctionEngine extends CoreEngine {
  /**
   * @typedef {CoreEngineOptions & {
   * }} DynamicFunctionEngineOptions
   *
   * @param {DynamicFunctionEngineOptions} options
   */
  constructor(options) {
    super(options)
  }

  /**
   * @override
   */
  async queryDataset({ name, input, justification, incomingMessages }) {
    // @todo use a different, more generic tag

    const operationId = getRandomId('op-')
    const actionId = getRandomId('action-')

    await this.sink?.push(TAG_INTENT_DETECTION_BEGIN, {
      id: operationId,

      action: {
        id: actionId,
      },
    })

    await this.sink?.push(TAG_INTENT_DETECTION_END, {
      id: operationId,

      action: {
        id: actionId,
        name: name,
      },
    })

    await this.sink?.push(TAG_OPERATION_BEGIN, {
      id: operationId,

      action: {
        id: actionId,
        kind: 'dataset',
        name: name,
        input: input,
        justification,
        icon: '@logo/chatbotkit.com',
      },
    })

    try {
      return await super.queryDataset({
        name,
        input,
        justification,
        incomingMessages,
      })
    } finally {
      await this.sink?.push(TAG_OPERATION_END, {
        id: operationId,

        action: {
          id: actionId,
          kind: 'dataset',
          name: name,
          input: input,
          icon: '@logo/chatbotkit.com',
        },
      })
    }
  }

  /**
   * @override
   */
  async executeSkillset({
    name,
    input,
    justification,
    incomingMessages,
    templateInstance,
  }) {
    // @todo use a different, more generic tag

    const operationId = getRandomId('op-')
    const actionId = getRandomId('action-')

    await this.sink?.push(TAG_INTENT_DETECTION_BEGIN, {
      id: operationId,

      action: {
        id: actionId,
      },
    })

    await this.sink?.push(TAG_INTENT_DETECTION_END, {
      id: operationId,

      action: {
        id: actionId,
        name: name,
      },
    })

    await this.sink?.push(TAG_OPERATION_BEGIN, {
      id: operationId,

      action: {
        id: actionId,
        kind: 'skillset',
        name: name,
        input: input,
        justification,
        icon: templateInstance?.icon,
      },
    })

    try {
      return await super.executeSkillset({
        name,
        input,
        justification,
        incomingMessages,
      })
    } finally {
      await this.sink?.push(TAG_OPERATION_END, {
        id: operationId,

        action: {
          id: actionId,
          kind: 'skillset',
          name: name,
          input: input,
          icon: templateInstance?.icon,
        },
      })
    }
  }

  /**
   * @override
   */
  async process(options = {}) {
    debug(`process messages`, { messages: this.messages })

    // refuse to run a blocked bot (usage policy / manual disable)
    await assertBotNotBlocked()

    options

    // setup usage

    const usage = new Usage()

    let addedMessages

    try {
      // setup new entities

      const newEntities = []

      // setup new messages

      const newMessages = []

      // setup messages

      // @note we are using MAX_PROCESS_MESSAGE_TAKE because we are only
      // interested in the last messages for this part of the process, rather
      // than all messages which are controlled my the model - this is a
      // deliberate choice that may require revisiting in the future

      const messages = await this.getMessages(MAX_PROCESS_MESSAGE_TAKE)

      // handle moderation
      {
        if (!(await this.handleModeration(newMessages, messages))) {
          return {
            usage,

            entities: newEntities,

            messages: newMessages,
          }
        }
      }

      // handle privacy
      {
        if (!(await this.handlePrivacy(newEntities, messages))) {
          return {
            usage,

            entities: newEntities,

            messages: newMessages,
          }
        }
      }

      // add new entities

      await this.addEntities(newEntities)

      // add new messages

      addedMessages = await this.addMessages(newMessages)

      // finish and return

      return {
        usage,

        entities: newEntities,

        messages: newMessages,
      }
    } finally {
      await usage.recordBaseTokens({
        user: { id: this.userId },
        meta: {
          reason: 'conversation/process',

          ...this.usageMeta,
        },
        references: {
          ...this.usageReferences,

          messageId: addedMessages?.slice(-1)[0]?.id,

          datasetId: this.datasetId,
          skillsetId: this.skillsetId,
        },
      })
    }
  }

  /**
   * @override
   */
  async complete(options = {}) {
    debug(`complete messages`, { messages: this.messages })

    // refuse to run a blocked bot (usage policy / manual disable)
    await assertBotNotBlocked()

    // setup usage

    const usage = new Usage()

    let addedMessages

    try {
      // setup new function messages

      const newFunctionMessages = []

      // setup new messages

      const newMessages = []

      // setup session messages

      const sessionMessages = []

      // new meta

      const newMeta = {}

      // parse model

      const { config: modelConfig } = this.breakdownLanguageModel()

      // @note we use the full model string (this.model) because the usage
      // reporting functions need to parse a complete model string

      const originalModel = this.model

      // setup messages

      const messages = await this.getMessages(MAX_COMPLETE_MESSAGE_TAKE)

      // setup incoming messages

      const incomingMessages = [...messages, ...sessionMessages]

      // build functions

      const functions = await this.getFunctions({
        newFunctionMessages,
        incomingMessages,
        usage,
        newMeta,
        signal: options.signal,
      })

      // build hint messages

      /** @type {Message[]} */
      const hintMessages = []

      hintMessages.push(
        ...functions.flatMap(({ hintMessages = [] }) => hintMessages)
      )

      // get functions for start and end phases

      const startFunctions = this.getFunctionsForPhase('start', functions)
      const endFunctions = this.getFunctionsForPhase('end', functions)

      // prepend forceFunction to startFunctions if defined

      const forceFunction = this.getForceFunction(modelConfig, functions)

      if (forceFunction && !startFunctions.includes(forceFunction)) {
        startFunctions.unshift(forceFunction)
      }

      // setup all messages

      const allMessages = messages.concat(hintMessages)

      // create conversation

      const itFn = this.getConvFunction(this.model)

      const it = itFn({
        clientId: this.getClientId(),

        model: this.model,

        messages: allMessages,

        modality: options.modality,

        // @note: dynamically obtain the functions to accomodate for changes
        functions: async () =>
          await this.getFunctions({
            newFunctionMessages,
            incomingMessages,
            usage,
            newMeta,
            signal: options.signal,
          }),

        startFunctions: startFunctions,

        endFunctions: endFunctions,

        background: this.isBackground(),

        // @note enabling settle = handing the conv function a settle budget; a
        // positive `maxSettles` turns on settlement (see the `batch.settle`
        // feature), undefined leaves it off
        maxSettles: this.isBatchSettle() ? DEFAULT_MAX_SETTLES : undefined,

        maxIterations: this.maxIterations,
        maxContinuations: this.maxContinuations,

        callStats: this.callStats,
        maxCalls: this.maxCalls,

        cycleStats: this.cycleStats,
        maxCycles: this.maxCycles,

        abortSignal: this.getAbortSignal(options.signal),

        yieldSignal: this.yieldSignal,

        context: this.convContext,

        // @note ephemeral, in-flight-only messages (e.g. timeout-budget
        // checkpoints): drained here and injected into this round's prompt by
        // optimizeMessages, then carried forward across rounds - never persisted,
        // and drained so they are not re-inserted (which would duplicate them)
        liveMessages: () => this.drainLiveMessages(),

        sink: this.convSink,
      })

      // stream messages

      const {
        messages: newStreamMessages,
        reason: completeReason,
        error: completeError,
      } = await this.stream(it, { usage, originalModel, sessionMessages })

      // add new stream messages

      newMessages.push(...newStreamMessages)

      // add function messages

      newMessages.push(
        // @note we filter out some messages because they are not needed as
        // they are already processed by the function
        // @todo maybe we should remove this because we need context at all time

        ...newFunctionMessages.filter(({ type }) => !['context'].includes(type))
      )

      // update new message with new meta

      newMessages.forEach((message) => {
        if (message.type === MessageType.bot) {
          message.meta = {
            ...newMeta,

            ...message.meta,
          }
        }
      })

      // sort messages

      sortMessages(newMessages, 'asc')

      // add new messages

      addedMessages = await this.addMessages(newMessages)

      // run compaction if enabled

      const { message: checkpointMessage } = await this.maybeCompact(usage)

      // finish and return

      return {
        usage,

        messages: checkpointMessage
          ? [...newMessages, checkpointMessage]
          : newMessages,

        reason: completeReason,

        error: completeError,
      }
    } finally {
      await usage.recordBaseTokens({
        user: { id: this.userId },
        meta: {
          reason: this.usageReason || 'conversation/complete',

          ...this.usageMeta,
        },
        references: {
          ...this.usageReferences,

          messageId: addedMessages?.slice(-1)[0]?.id,

          datasetId: this.datasetId,
          skillsetId: this.skillsetId,
        },
      })
    }
  }

  /**
   * @override
   */
  async apply(options) {
    debug(`apply messages`, { messages: this.messages, options })

    // setup usage

    const usage = new Usage()

    let addedMessages

    try {
      // setup new function messages

      const newFunctionMessages = []

      // setup new messages

      const newMessages = []

      // setup session messages

      const sessionMessages = []

      // new meta

      const newMeta = {}

      // setup messages

      const messages = await this.getMessages(MAX_COMPLETE_MESSAGE_TAKE)

      // setup incoming messages

      const incomingMessages = [...messages, ...sessionMessages]

      // build functions

      const functions = await this.getFunctions({
        newFunctionMessages,
        incomingMessages,
        usage,
        newMeta,
        signal: options.signal,
      })

      const fn = functions.find(({ name }) => name === options.name)

      if (!fn) {
        throwNotFound(`Function not found`)
      }

      if (!fn.handler) {
        throwBadRequest(`Function cannot be applied server-side`)
      }

      let result = await fn.handler(options.input, {
        newMessages: [],
      })
      let meta

      if (result instanceof AbortSignal) {
        if (result.aborted) {
          result = result.reason || null
        }
      } else if (result instanceof Result) {
        meta = result.meta
        result = result.result
      } else if (result instanceof Error) {
        result = { error: result.message }
      }

      // add function messages

      newMessages.push(
        // @note we filter out some messages because they are not needed as
        // they are already processed by the function
        // @todo maybe we should remove this because we need context at all time

        ...newFunctionMessages.filter(({ type }) => !['context'].includes(type))
      )

      // update new message with new meta

      newMessages.forEach((message) => {
        if (message.type === MessageType.bot) {
          message.meta = {
            ...newMeta,

            ...message.meta,
          }
        }
      })

      // sort messages

      sortMessages(newMessages, 'asc')

      // add new messages

      addedMessages = await this.addMessages(newMessages)

      // run compaction if enabled

      const { message: checkpointMessage } = await this.maybeCompact(usage)

      // finish and return

      return {
        usage,

        messages: checkpointMessage
          ? [...newMessages, checkpointMessage]
          : newMessages,

        result,

        meta: {
          ...newMeta,
          ...meta,
        },
      }
    } finally {
      await usage.recordBaseTokens({
        user: { id: this.userId },
        meta: {
          reason: 'conversation/apply',

          ...this.usageMeta,
        },
        references: {
          ...this.usageReferences,

          messageId: addedMessages?.slice(-1)[0]?.id,

          datasetId: this.datasetId,
          skillsetId: this.skillsetId,
        },
      })
    }
  }
}

/**
 * @param {typeof CoreEngine} EngineClass
 * @param {string} model
 * @param {string} userId
 * @returns {Promise<typeof CoreEngine>}
 * @throws {Error}
 */
export async function wrapEngine(EngineClass, model, userId) {
  debug(`wrapping engine`, { model, userId })

  // check if the user can use a model
  {
    const user = await fastGetUserById(userId)

    if (user) {
      const { effectiveUser } = await revealUserPlan(user)

      if (
        await neitherTrue([
          canUseModel(user, model),
          canUseModel(effectiveUser, model),
        ])
      ) {
        throwNoSubscription(`You need a subscription to use this model`)
      }
    }
  }

  // return the effective engine class
  {
    const { originalName, config } = parseAndRevealLanguageModel(model)

    if (originalName === 'custom') {
      if (!('credentials' in config)) {
        throw new Error(`Missing credentials in the model configuration`)
      }

      const user = await fastGetUserById(userId)

      if (user) {
        const { effectiveUser } = await revealUserPlan(user)

        if (
          await neitherTrue([
            canUseCustomModel(user),
            canUseCustomModel(effectiveUser),
          ])
        ) {
          throwNoSubscription(`You need a subscription to use custom models`)
        }
      }

      return class extends EngineClass {
        /**
         * @override
         */
        process(options) {
          return runInModelContext(() => {
            const store = getModelStore()

            store[`${config.provider}Key`] = config.credentials
            store[`${config.provider}Url`] = config.endpoint

            return super.process(options)
          })
        }

        /**
         * @override
         */
        complete(options) {
          return runInModelContext(() => {
            const store = getModelStore()

            store[`${config.provider}Key`] = config.credentials
            store[`${config.provider}Url`] = config.endpoint

            return super.complete(options)
          })
        }

        /**
         * @override
         */
        apply(options) {
          return runInModelContext(() => {
            const store = getModelStore()

            store[`${config.provider}Key`] = config.credentials
            store[`${config.provider}Url`] = config.endpoint

            return super.apply(options)
          })
        }

        /**
         * @override
         */
        snapshot(options) {
          return runInModelContext(() => {
            const store = getModelStore()

            store[`${config.provider}Key`] = config.credentials
            store[`${config.provider}Url`] = config.endpoint

            return super.snapshot(options)
          })
        }
      }
    } else {
      return EngineClass
    }
  }
}

/**
 * Applies active experiments to the given options.
 *
 * @param {CoreEngineOptions} options
 * @returns {Promise<CoreEngineOptions>}
 */
async function applyExperiments(options) {
  const features = [...(options.features || [])]

  if (await isInExperiment('conversation.engine.chunking', options.userId)) {
    features.push({ name: 'chunking' })
  }

  return {
    ...options,

    features,
  }
}

/**
 * @typedef {{
 *   untrusted?: boolean,
 *   options: CoreEngineOptions
 * }} AutoEngineOptions
 */

/**
 * Gets an engine class based on the options.
 *
 * @param {AutoEngineOptions} options
 * @returns {Promise<typeof CoreEngine>}
 */
export async function getAutoEngineClass(options) {
  debug(`getting auto engine class`, {
    options,
  }).log('conversation.engine.getAutoEngineClass')

  const { untrusted = false } = options

  // Reset the namespace and contact if untrusted.
  {
    if (untrusted) {
      debug(`untrusted context, resetting namespace and contact`).log(
        'conversation.engine.getAutoEngineClass'
      )

      resetContextNamespace()
      resetContextContact()
    }
  }

  const { userId, model } = options.options

  const modelString = model || defaultLanguageModel

  switch (true) {
    case modelSupportsFunctions(modelString): {
      debug(`using dynamic function engine`, { modelString }).log(
        'conversation.engine.getAutoEngineClass'
      )

      return await wrapEngine(DynamicFunctionEngine, modelString, userId)
    }

    default: {
      debug(`using basic function engine`, { modelString }).log(
        'conversation.engine.getAutoEngineClass'
      )

      return await wrapEngine(BasicFunctionEngine, modelString, userId)
    }
  }
}

/**
 * Gets an engine based on the options.
 *
 * @param {AutoEngineOptions} options
 * @returns {Promise<CoreEngine>}
 */
export async function getAutoEngine(options) {
  const EngineClass = await getAutoEngineClass(options)

  const engineOptions = await applyExperiments(options.options)

  return new EngineClass(engineOptions)
}

/**
 * @typedef {{
 *   options: Omit<AutoEngineOptions['options'],'backstory'|'model'|'privacy'|'moderation'|'datasetId'|'skillsetId'|'messages'>
 * } & AutoEngineOptions} ConversationEngineOptions
 */

/**
 * @typedef {{
 *   conversationId: string,
 *   messageTypes?: MessageType[],
 *   messageTake?: number,
 * } & ConversationEngineOptions} StatefulConversationEngineOptions
 */

/**
 * Gets a stateful conversation engine based on the options.
 *
 * @param {StatefulConversationEngineOptions} options
 * @returns {Promise<typeof CoreEngine>}
 */
export async function getStatefulConversationEngineClass(options) {
  debug(`getting stateful conversation engine class`, {
    options,
  }).log('conversation.engine.getStatefulConversationEngineClass')

  const {
    conversationId,

    messageTypes = Object.values(MessageType), // @note all message types are allowed by default

    messageTake: messageTakeOverride, // @note resolved below from the actual model after conversation fetch
  } = options

  /** @type {import('@/prisma/types').Conversation} */
  let conversation
  /** @type {import('@/prisma/types').Bot|null} */
  let bot
  /** @type {import('@/prisma/types').Contact|null} */
  let contact
  /** @type {Pick<import('@/prisma/types').Message,'id'|'type'|'text'|'meta'|'createdAt'>[]} */
  let messages

  {
    debug(`locating conversation`, {
      conversationId,

      messageTypes,

      messageTakeOverride,
    })

    // @note we need to split the query in two separate queries because we can
    // run out of memory

    // Fetch the conversation (with bot and contact) in parallel with the
    // guaranteed message fetches. messageTake cannot be resolved until we know
    // the conversation's actual model, so the window query runs after.

    // Guaranteed fetches: last backstory and last checkpoint are both fetched
    // independently - immune to the take limit and the checkpoint createdAt
    // filter. Backstory is the system prompt; checkpoint is the last compaction
    // summary. Both must always be present regardless of what the window query
    // returns.

    const [conversationInstance, lastBackstory, lastCheckpoint] =
      await Promise.all([
        prisma.conversation.findUnique({
          where: {
            id: conversationId,
          },

          include: {
            bot: true, // required

            contact: true, // required
          },

          // @note no caching whatsoever because this could result in not getting
          // the latest messages, unless we implement our own caching mechanism that
          // is aware of the conversation state
        }),

        prisma.message.findFirst({
          where: {
            conversationId: conversationId,
            type: MessageType.backstory,
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            text: true,
            meta: true,
            createdAt: true,
          },
        }),

        prisma.message.findFirst({
          where: {
            conversationId: conversationId,
            type: MessageType.checkpoint,
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            text: true,
            meta: true,
            createdAt: true,
          },
        }),
      ])

    if (!conversationInstance) {
      return throwNotFound(`Conversation not found`)
    }

    if (conversationInstance.userId !== options.options.userId) {
      return throwNotAuthorized(`Not authorized to access this conversation`)
    }

    conversation = conversationInstance

    bot = conversationInstance.bot

    contact = conversationInstance.contact

    // Resolve the model the engine will actually run with so that messageTake
    // reflects the correct interactionMaxMessages - not the default model's.

    const resolvedModel =
      getConversationDetailsField(
        conversation,
        'model',
        options.options.model
      ) ?? defaultLanguageModel

    const { config: resolvedModelConfig } =
      parseAndRevealLanguageModel(resolvedModel)

    const messageTake =
      messageTakeOverride ??
      resolvedModelConfig.interactionMaxMessages ??
      Math.max(MAX_PROCESS_MESSAGE_TAKE, MAX_COMPLETE_MESSAGE_TAKE)

    debug(`using messageTake`, { messageTake })

    // Window fetch: recent messages bounded by the checkpoint date and take
    // limit. Both backstory and checkpoint are excluded - they are guaranteed
    // above and must not consume the take budget or appear twice.

    const GUARANTEED_TYPES = /** @type {Set<string>} */ (
      new Set([MessageType.backstory, MessageType.checkpoint])
    )

    const windowTypes = (
      messageTypes.length ? messageTypes : Object.values(MessageType)
    ).filter((type) => !GUARANTEED_TYPES.has(type))

    const windowMessages = await prisma.message.findMyriad({
      where: {
        conversationId: conversationId,

        type: { in: windowTypes },

        ...(lastCheckpoint
          ? { createdAt: { gte: lastCheckpoint.createdAt } }
          : null),
      },

      select: {
        id: true,

        type: true,
        text: true,

        meta: true,

        createdAt: true,
      },

      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],

      take: messageTake,
    })

    // Assembly order: backstory, checkpoint, window

    messages = [
      ...(lastBackstory ? [lastBackstory] : []),

      ...(lastCheckpoint ? [lastCheckpoint] : []),

      ...windowMessages,
    ]
  }

  // Update the context with the namespace.
  {
    const namespace = conversation.id

    if (namespace) {
      // @note only when not set previously to avoid overwriting

      if (getContextNamespace() === null) {
        debug(`setting context namespace`, { namespace }).log(
          'conversation.engine.getStatefulConversationEngineClass'
        )

        setContextNamespace(namespace)
      }
    }
  }

  // Update the context with the contact.
  {
    if (contact) {
      // @note only when not set previously to avoid overwriting

      if (getContextContact() === null) {
        debug(`setting context contact`, {
          contact,
        }).log('conversation.engine.getStatelessConversationEngineClass')

        setContextContact(contact)
      }
    }
  }

  // Update the context with the conversation.
  {
    // @note only when not set previously to avoid overwriting

    if (getContextConversation() === null) {
      debug(`setting context conversation`, {
        conversationId: conversation,
      }).log('conversation.engine.getStatefulConversationEngineClass')

      setContextConversation(conversation)
    }
  }

  // Update the context with the bot.
  {
    if (bot) {
      // @note only when not set previously to avoid overwriting

      if (getContextBot() === null) {
        debug(`setting context bot`, {
          bot,
        }).log('conversation.engine.getStatelessConversationEngineClass')

        setContextBot(bot)
      }
    }
  }

  // Sort the message in the right order, as expected by the engine.
  {
    sortMessages(messages, 'asc')
  }

  // Set options.

  /** @type {string|undefined} */
  const backstory =
    getConversationDetailsField(
      conversation,
      'backstory',
      options.options.backstory
    ) ?? undefined

  /** @type {string|undefined} */
  const model =
    getConversationDetailsField(conversation, 'model', options.options.model) ??
    undefined

  /** @type {boolean|undefined} */
  const privacy =
    getConversationDetailsField(
      conversation,
      'privacy',
      options.options.privacy
    ) ?? undefined
  /** @type {boolean|undefined} */
  const moderation =
    getConversationDetailsField(
      conversation,
      'moderation',
      options.options.moderation
    ) ?? undefined

  /** @type {string|undefined} */
  const datasetId =
    getConversationDetailsField(
      conversation,
      'datasetId',
      options.options.datasetId
    ) ?? undefined
  /** @type {string|undefined} */
  const skillsetId =
    getConversationDetailsField(
      conversation,
      'skillsetId',
      options.options.skillsetId
    ) ?? undefined

  // Get the engine class.

  const EngineClass = await getAutoEngineClass({
    ...options,

    options: {
      model, // @note we need the model to correctly get the engine class

      ...options.options,
    },
  })

  // Extend the engine class with the conversation engine.

  return class extends EngineClass {
    /** @type {string} */
    #conversationId

    /**
     * Monotonic high-water mark (epoch ms) used to assign message `createdAt`
     * values. See {@link createMessages} for the rationale.
     *
     * @note this is per engine instance. It is seeded from the latest loaded
     * message (constructor) so sequential turns and a late checkpoint carried
     * into the next turn stay ordered, and the queue processes a conversation
     * one turn at a time. But two engine instances writing the SAME conversation
     * concurrently do not share this watermark: their writes merge by timestamp
     * and can collide on the same millisecond (reads then fall back to `id`,
     * which cuid does not order reliably). This residual cannot be closed with an
     * in-process counter.
     * @todo if a hard cross-writer ordering guarantee is ever needed, move the
     * sequence to a shared source - a DB monotonic/auto-increment ordering column
     * or a per-conversation advisory lock around the write.
     *
     * @type {number}
     */
    #lastCreatedAtMs = 0

    /**
     * @param {CoreEngineOptions} options
     */
    constructor(options) {
      super({
        ...options,

        // @note automatically attach a live-monitoring sink to every stateful
        // execution so any conversation can be observed via its monitor channel
        // (used by /conversation/[conversationId]/channel/subscribe) without
        // each call site wiring it up. Composed with - not replacing - the
        // caller's sink; the monitor sink filters out high-frequency
        // token/audio events internally so this stays cheap and never blocks.
        sink: combineSinks([
          options.sink,
          createConversationMonitorSink({
            userId: conversation.userId,
            conversationId: conversation.id,
          }),
        ]),

        backstory,

        model,

        privacy,
        moderation,

        datasetId,
        skillsetId,

        messages,

        // @todo maybe propagate meta from the conversation

        usageMeta: {
          ...options.usageMeta,
        },
        usageReferences: {
          ...options.usageReferences,

          conversationId: conversation.id,
          botId: bot?.id,
        },
      })

      this.#conversationId = conversation.id

      // @note seed the timestamp watermark from the latest message we loaded so
      // a fresh turn - or a late async checkpoint carried over from a prior
      // turn - can never tie below an existing row. Wall-clock time normally
      // already exceeds this; seeding just makes ordering airtight across engine
      // instances writing to the same conversation.
      this.#lastCreatedAtMs = (Array.isArray(messages) ? messages : []).reduce(
        (max, message) => {
          const ms = message?.createdAt
            ? new Date(message.createdAt).getTime()
            : 0

          return ms > max ? ms : max
        },
        0
      )
    }

    /**
     * Returns the conversation id.
     *
     * @returns {string}
     */
    get conversationId() {
      return this.#conversationId
    }

    /**
     * This overrides the addMessages method to create messages before adding
     * them to the engine.
     *
     * @override
     */
    async addMessages(messages) {
      debug(`adding messages`, { messages }).log(
        'conversation.engine.getStatefulConversationEngineClass.EngineClass.addMessages'
      )

      const newMessages = await this.createMessages(messages)

      // @note validate that we received the expected number of messages to
      // prevent undefined access errors

      assert(
        newMessages.length === messages.length,
        `Message creation mismatch: expected ${messages.length} messages but received ${newMessages.length}`
      )

      // @todo it will be better if we reconcile messages at a later stage
      // so that we can bulk them up better

      // @note because we created the messages we need to also update each
      // messages item with the id and meta information

      for (let i = 0; i < messages.length; i++) {
        const newMessage = newMessages[i]

        messages[i] = {
          ...messages[i],

          id: newMessage.id,
          meta: newMessage.meta,
        }
      }

      return super.addMessages(newMessages)
    }

    /**
     * @param {Message[]} messages
     * @returns {Promise<Message[]>}
     */
    async createMessages(messages) {
      debug(`creating messages`, { messages }).log(
        'conversation.engine.getStatefulConversationEngineClass.EngineClass.createMessages'
      )

      let trackPromise
      let usagePromise
      let abusePromise

      try {
        // track idling conversation
        {
          trackPromise = trackIdlingConversation(
            this.#conversationId,
            ONE_HOUR_IN_MILLISECONDS // @todo make timeOffset configurable
          )
        }

        // @note honor the producer's real creation time when it carries one
        // (e.g. the stream stamps a bot message at its first token, the queue
        // checkpoint fires at a real moment), falling back to the write time
        // otherwise. A monotonic high-water mark then keeps timestamps strictly
        // increasing in array order: messages within the same millisecond, an
        // absent createdAt, or one that arrives out of order are nudged forward
        // by 1ms rather than colliding with or preceding an already-assigned
        // one. The clamp only ever moves a timestamp later, never earlier, so a
        // genuine creation time is preserved whenever it does not violate order.
        const createdAtMap = messages.map((message) => {
          const provided = message.createdAt
            ? new Date(message.createdAt).getTime()
            : Number.NaN

          const base = Number.isFinite(provided) ? provided : Date.now()

          const ms = Math.max(base, this.#lastCreatedAtMs + 1)

          this.#lastCreatedAtMs = ms

          return new Date(ms)
        })

        // record messages using bulk insert to avoid N+1 query pattern
        // @note do not filter empty messages as this will prevent recording
        // activity messages too
        // @note we generate IDs client-side to avoid a follow-up query

        const messageData = messages.map((message, index) => {
          const id = cuid()

          const createdAt = createdAtMap[index]

          debug(`creating message`, { message, createdAt })

          const { type, text, meta } = message

          // @todo the message text might be larger than the allowed size thus
          // we need to split it up to multiple messages

          return {
            id,

            conversationId: this.#conversationId,

            type: type,
            text: byteSlice(text, 0, MAX_DB_TEXT_BYTES_LENGTH), // @todo instead of slicing split the message into shorter messages

            meta: meta,

            createdAt: createdAt, // @note monotonic wall-clock; see createdAtMap above
          }
        })

        await prisma.message.createMany({
          data: messageData,
        })

        // @note no need to query back - we already have the IDs

        const newMessages = messageData.map(({ id, type, text, meta }) => ({
          id,
          type,
          text,
          meta,
        }))

        // record message usage
        {
          if (newMessages.length) {
            usagePromise = recordMessageUsage({
              user: { id: this.userId },
              count: newMessages.length,
            })
          }
        }

        // if there are any abuse messages then we need to update the conversation
        // meta with the abuse information
        {
          // @todo perhaps move this when the conversation becomes idle

          const { abuse } = messages.find(({ meta }) => meta?.abuse)?.meta || {}

          if (abuse) {
            abusePromise = (async () => {
              const conversation = await prisma.conversation.findUnique({
                where: {
                  id: this.#conversationId,
                },

                select: {
                  id: true,
                  meta: true,
                },
              })

              if (conversation) {
                await prisma.conversation.update({
                  where: {
                    id: conversation.id,
                  },

                  data: {
                    meta: {
                      // @todo find out why this is not working
                      // @ts-ignore
                      ...conversation.meta,

                      abuse,
                    },
                  },
                })
              }
            })()
          }
        }

        return newMessages
      } finally {
        // await all deferred operations

        await Promise.all([trackPromise, usagePromise, abusePromise])
      }
    }
  }
}

/**
 * Gets a stateful conversation engine instance.
 *
 * @param {StatefulConversationEngineOptions} options
 * @returns {Promise<CoreEngine>}
 */
export async function getStatefulConversationEngine(options) {
  const EngineClass = await getStatefulConversationEngineClass(options)

  const engineOptions = await applyExperiments(options.options)

  return new EngineClass(engineOptions)
}

/**
 * @param {string|undefined|null} value
 * @returns {string|undefined|null}
 */
function normalizeOptionalConversationString(value) {
  return value === '' ? undefined : value
}

/**
 * @typedef {{
 *   backstory?: string,
 *   model?: string,
 *   privacy?: boolean,
 *   moderation?: boolean,
 *   botId?: string,
 *   datasetId?: string,
 *   skillsetId?: string,
 *   messages?: Message[],
 *   namespace?: string,
 *   contact?: Pick<import('@/prisma/types').Contact,'id'>|Omit<import('@/prisma/types').Contact,'id'|'userId'|'createdAt'|'updatedAt'>
 * } & ConversationEngineOptions} StatelessConversationEngineOptions
 */

/**
 * Gets a stateful conversation engine based on the options.
 *
 * @param {StatelessConversationEngineOptions} options
 * @returns {Promise<typeof CoreEngine>}
 */
export async function getStatelessConversationEngineClass(options) {
  debug(`getting stateless conversation engine class`, {
    options,
  }).log('conversation.engine.getStatelessConversationEngineClass')

  const {
    backstory: _backstory,

    model: _model,

    privacy: _privacy,
    moderation: _moderation,

    botId: _botId,
    datasetId: _datasetId,
    skillsetId: _skillsetId,

    messages,

    namespace: _namespace,

    contact: _contact,
  } = options

  /** @type {import('@/prisma/types').Bot|null} */
  let bot = null

  {
    debug(`locating bot`, {
      botId: _botId,
    })

    if (_botId) {
      bot = await prisma.bot.findUniqueByIdentifier(
        { id: options.options.userId },
        _botId
      )

      if (!bot) {
        return throwNotFound(`Bot not found`)
      }

      if (!canUseBot(options.options.userId, bot)) {
        return throwNotAuthorized(`Not authorized to use this bot`)
      }
    }
  }

  // Update the context with the namespace.
  {
    const namespace = _namespace
      ? getSafeNamespace({ id: options.options.userId }, _namespace)
      : _namespace

    if (namespace) {
      // @note only when not set previously to avoid overwriting

      if (getContextNamespace() === null) {
        debug(`setting context namespace`, { namespace }).log(
          'conversation.engine.getStatefulConversationEngineClass'
        )

        setContextNamespace(namespace)
      }
    }
  }

  // Update the context with the contact.
  {
    let contact

    if (_contact) {
      if ('id' in _contact) {
        if (_contact.id) {
          contact = await prisma.contact.findUnique({
            where: {
              id: _contact.id,
            },
          })

          if (!contact) {
            return throwNotFound(`Contact not found`)
          }

          if (!canUseContact(options.options.userId, contact)) {
            return throwNotAuthorized(`Not authorized to use this contact`)
          }
        }
      } else {
        contact = await ensureTrustedContact(
          { id: options.options.userId },
          _contact,
          _contact.fingerprint
        )
      }

      if (contact) {
        // @note only when not set previously to avoid overwriting

        if (getContextContact() === null) {
          debug(`setting context contact`, {
            contact,
          }).log('conversation.engine.getStatefulConversationEngineClass')

          setContextContact(contact)
        }
      }
    }
  }

  // Update the context with the conversation.
  {
    // pass
  }

  // Update the context with the bot.
  {
    if (bot) {
      // @note only when not set previously to avoid overwriting

      if (getContextBot() === null) {
        debug(`setting context bot`, {
          bot,
        }).log('conversation.engine.getStatefulConversationEngineClass')

        setContextBot(bot)
      }
    }
  }

  // Sort the message in the right order, as expected by the engine.
  {
    if (messages) {
      sortMessages(messages, 'asc')
    }
  }

  // Get pseudo conversation to extract details from.

  const pseudoConversation = {
    backstory: normalizeOptionalConversationString(_backstory),

    model: normalizeOptionalConversationString(_model),

    privacy: _privacy,
    moderation: _moderation,

    botId: normalizeOptionalConversationString(_botId),
    datasetId: normalizeOptionalConversationString(_datasetId),
    skillsetId: normalizeOptionalConversationString(_skillsetId),

    bot: bot,
  }

  // Set options.

  /** @type {string|undefined} */
  const backstory =
    getConversationDetailsFieldWithReversedPrecedence(
      pseudoConversation,
      'backstory',
      options.options.backstory
    ) ?? undefined

  /** @type {string|undefined} */
  const model =
    getConversationDetailsFieldWithReversedPrecedence(
      pseudoConversation,
      'model',
      options.options.model
    ) ?? undefined

  /** @type {boolean|undefined} */
  const privacy =
    getConversationDetailsFieldWithReversedPrecedence(
      pseudoConversation,
      'privacy',
      options.options.privacy
    ) ?? undefined
  /** @type {boolean|undefined} */
  const moderation =
    getConversationDetailsFieldWithReversedPrecedence(
      pseudoConversation,
      'moderation',
      options.options.moderation
    ) ?? undefined

  /** @type {string|undefined} */
  const datasetId =
    getConversationDetailsFieldWithReversedPrecedence(
      pseudoConversation,
      'datasetId',
      options.options.datasetId
    ) ?? undefined
  /** @type {string|undefined} */
  const skillsetId =
    getConversationDetailsFieldWithReversedPrecedence(
      pseudoConversation,
      'skillsetId',
      options.options.skillsetId
    ) ?? undefined

  // Get the engine class.

  const EngineClass = await getAutoEngineClass({
    ...options,

    options: {
      model, // @note we need the model to correctly get the engine class

      ...options.options,
    },
  })

  // Extend the engine class with the conversation engine.

  return class extends EngineClass {
    /**
     * @param {CoreEngineOptions} options
     */
    constructor(options) {
      super({
        ...options,

        backstory,

        model,

        privacy,
        moderation,

        datasetId,
        skillsetId,

        messages,

        // @todo maybe propagate meta from the conversation

        usageMeta: {
          ...options.usageMeta,
        },
        usageReferences: {
          ...options.usageReferences,

          // @note the stateless engine has no persisted conversation and may
          // not resolve a bot, so fall back to the caller-provided references
          // instead of clobbering them with undefined

          conversationId:
            pseudoConversation.id ?? options.usageReferences?.conversationId,
          botId: bot?.id ?? options.usageReferences?.botId,
        },
      })
    }
  }
}

/**
 * Gets a stateful conversation engine instance.
 *
 * @param {StatelessConversationEngineOptions} options
 * @returns {Promise<CoreEngine>}
 */
export async function getStatelessConversationEngine(options) {
  const EngineClass = await getStatelessConversationEngineClass(options)

  const engineOptions = await applyExperiments(options.options)

  return new EngineClass(engineOptions)
}
